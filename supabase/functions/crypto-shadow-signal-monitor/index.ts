import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get('SUPABASE_URL')||'';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const SECRET=Deno.env.get('MONITOR_SECRET')||'';
const db=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const BINANCE=['https://data-api.binance.vision','https://api.binance.com'];
const TTL:Record<string,number>={'5M':6*60*60*1000,'1H':24*60*60*1000,'4H':72*60*60*1000};
const MAX_BAR_PAGES=7;

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function overlap(low:number,high:number,a:number,b:number){return low<=Math.max(a,b)&&high>=Math.min(a,b)}
function iso(ms:number){return new Date(ms).toISOString()}

async function fetchBars(symbol:string,start:number){
  let lastError:unknown;
  const safeStart=Math.max(Date.now()-74*60*60*1000,start-60000);
  for(const base of BINANCE){
    try{
      const all:any[]=[];let cursor=safeStart;
      for(let page=0;page<MAX_BAR_PAGES&&cursor<Date.now();page++){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
        try{
          const response=await fetch(`${base}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&startTime=${cursor}&limit=1000`,{signal:controller.signal,headers:{Accept:'application/json'}});
          clearTimeout(timer);
          if(!response.ok)throw new Error(`Binance ${response.status}`);
          const raw=await response.json();
          const rows=(Array.isArray(raw)?raw:[]).map((x:any)=>({openTime:+x[0],high:+x[2],low:+x[3],close:+x[4],closeTime:+x[6]})).filter((x:any)=>[x.openTime,x.high,x.low,x.close,x.closeTime].every(Number.isFinite)&&x.closeTime<=Date.now());
          if(!rows.length)break;
          all.push(...rows);
          const next=rows.at(-1).closeTime+1;
          if(next<=cursor||rows.length<1000)break;
          cursor=next;
        }catch(error){clearTimeout(timer);throw error}
      }
      const unique=new Map<number,any>();for(const bar of all)unique.set(bar.openTime,bar);
      return [...unique.values()].sort((a,b)=>a.openTime-b.openTime);
    }catch(error){lastError=error}
  }
  throw lastError||new Error('Binance 1m history unavailable');
}

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'POST only'},405);
  if(!SECRET||req.headers.get('x-monitor-secret')!==SECRET)return json({error:'Unauthorized'},401);
  if(!URL||!KEY)return json({error:'Supabase configuration unavailable'},503);
  try{
    const {data:signals,error}=await db.from('crypto_shadow_signals').select('*').in('status',['WAITING','ACTIVE']).order('created_at',{ascending:true}).limit(500);
    if(error)throw error;
    const groups=new Map<string,any[]>();
    for(const signal of signals||[]){const pair=`${signal.symbol}USDT`;if(!groups.has(pair))groups.set(pair,[]);groups.get(pair)!.push(signal)}
    let checked=0,expired=0,activated=0,tp1Count=0,tp2Count=0,tp3Count=0,stops=0,breakeven=0,protectedProfit=0,closed=0,recovered=0;
    const errors:string[]=[];

    for(const [pair,list] of groups){
      let bars:any[]=[];
      try{
        const start=Math.min(...list.map(signal=>new Date(signal.last_checked_at||signal.entry_at||signal.created_at).getTime()));
        bars=await fetchBars(pair,start);
      }catch(error){errors.push(`${pair}: ${error instanceof Error?error.message:String(error)}`);continue}

      for(const signal of list){
        checked++;
        const originalLastChecked=signal.last_checked_at;
        let status=String(signal.status),stage=String(signal.management_stage||'ORIGINAL');
        let entryAt=signal.entry_at,tp1At=signal.tp1_at,tp2At=signal.tp2_at,tp3At=signal.tp3_at,closedAt=signal.closed_at,closeType=signal.close_type;
        let realizedR=finite(signal.realized_r),managedStop=finite(signal.managed_stop)??Number(signal.initial_stop),lastPrice=finite(signal.last_price);
        const long=signal.direction==='LONG',entryLow=Number(signal.entry_low),entryHigh=Number(signal.entry_high),mid=(entryLow+entryHigh)/2,initialStop=Number(signal.initial_stop),risk=Math.abs(mid-initialStop),tp1=finite(signal.tp1),tp2=finite(signal.tp2),tp3=finite(signal.tp3),createdMs=new Date(signal.created_at).getTime(),deadline=createdMs+(TTL[signal.timeframe]||72*60*60*1000);
        const since=originalLastChecked?new Date(originalLastChecked).getTime()-1000:Math.ceil(createdMs/60000)*60000;
        const relevant=bars.filter(bar=>originalLastChecked?bar.closeTime>=since:bar.openTime>=since);

        for(const bar of relevant){
          if(status!=='WAITING'&&status!=='ACTIVE')break;
          lastPrice=bar.close;
          if(status==='WAITING'){
            if(bar.openTime>deadline)break;
            if(!overlap(bar.low,bar.high,entryLow,entryHigh))continue;
            status='ACTIVE';entryAt=entryAt||iso(bar.closeTime);managedStop=initialStop;activated++;
            if(!originalLastChecked)recovered++;
          }

          // After an entry is possible, Stop wins any same-1m ambiguity.
          const stopHit=long?bar.low<=managedStop:bar.high>=managedStop;
          if(stopHit){
            status='CLOSED';closedAt=iso(bar.closeTime);closed++;
            if(stage==='LOCK_TP1'){
              closeType='PROTECTED_TP1';realizedR=risk>0&&tp1!==null?Math.abs(tp1-mid)/risk:1;protectedProfit++;
            }else if(stage==='BREAKEVEN'){
              closeType='BREAKEVEN';realizedR=0;breakeven++;
            }else{
              closeType='STOP';realizedR=-1;stops++;
            }
            break;
          }

          const favorable=long?bar.high:bar.low;
          const reaches=(level:number|null)=>level!==null&&(long?favorable>=level:favorable<=level);
          if(!tp1At&&reaches(tp1)){tp1At=iso(bar.closeTime);managedStop=mid;stage='BREAKEVEN';tp1Count++}
          if(!tp2At&&reaches(tp2)){if(!tp1At){tp1At=iso(bar.closeTime);tp1Count++}tp2At=iso(bar.closeTime);managedStop=tp1??mid;stage='LOCK_TP1';tp2Count++}
          if(!tp3At&&reaches(tp3)){if(!tp1At){tp1At=iso(bar.closeTime);tp1Count++}if(!tp2At&&tp2!==null){tp2At=iso(bar.closeTime);tp2Count++}tp3At=iso(bar.closeTime);status='CLOSED';closeType='TP3';closedAt=iso(bar.closeTime);realizedR=risk>0&&tp3!==null?Math.abs(tp3-mid)/risk:null;tp3Count++;closed++;break}
        }

        if(status==='WAITING'&&Date.now()>deadline){status='EXPIRED';closeType='EXPIRED';closedAt=iso(deadline);realizedR=null;expired++}
        const update={status,management_stage:stage,entry_at:entryAt,tp1_at:tp1At,tp2_at:tp2At,tp3_at:tp3At,closed_at:closedAt,close_type:closeType,realized_r:realizedR,managed_stop:managedStop,last_price:lastPrice,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        const {error:updateError}=await db.from('crypto_shadow_signals').update(update).eq('id',signal.id);
        if(updateError)errors.push(`${signal.id}: ${updateError.message}`);
      }
    }

    return json({success:true,monitor_version:5,source:'crypto_shadow_signals',price_engine:'binance_1m_recovery_aware_stop_first',checked,recovered,expired,activated,tp1:tp1Count,tp2:tp2Count,tp3:tp3Count,stops,breakeven,protected_profit:protectedProfit,closed,errors:errors.slice(0,30)});
  }catch(error){console.error('crypto-shadow-signal-monitor',error);return json({success:false,monitor_version:5,error:error instanceof Error?error.message:String(error)},500)}
});