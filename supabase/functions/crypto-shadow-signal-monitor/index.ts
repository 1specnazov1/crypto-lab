import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get('SUPABASE_URL')||'';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const SECRET=Deno.env.get('MONITOR_SECRET')||'';
const db=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const BINANCE=['https://data-api.binance.vision','https://api.binance.com'];
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}})}
function finite(value:unknown){const number=Number(value);return Number.isFinite(number)?number:null}

async function ingestShadowCandidates(){
 const since=new Date(Date.now()-6*60*60*1000).toISOString();
 const{data:runs,error}=await db.from('crypto_scanner_runs').select('id,scanner_version,finished_at,dry_run,class_a').eq('success',true).eq('dry_run',true).gte('finished_at',since).order('id',{ascending:true}).limit(100);
 if(error)throw error;let inserted=0,duplicates=0;
 for(const run of runs||[])for(const plan of Array.isArray(run.class_a)?run.class_a:[]){
  if(!plan?.symbol||!['5M','1H','4H'].includes(String(plan.timeframe))||!['LONG','SHORT'].includes(String(plan.direction)))continue;
  const row={scanner_version:Number(run.scanner_version)||15,source_run_id:run.id,symbol:String(plan.symbol),timeframe:String(plan.timeframe),direction:String(plan.direction),setup:String(plan.setup||''),strength:Number(plan.strength||plan.qualityScore)||null,entry_low:Number(plan.entry_low),entry_high:Number(plan.entry_high),initial_stop:Number(plan.stop),managed_stop:Number(plan.stop),tp1:Number(plan.tp1),tp2:finite(plan.tp2),tp3:finite(plan.tp3),metrics:plan.metrics||{},news:plan.news||{},status:'WAITING',management_stage:'ORIGINAL',last_checked_at:run.finished_at||new Date().toISOString()};
  if(![row.entry_low,row.entry_high,row.initial_stop,row.tp1].every(Number.isFinite))continue;
  const{error:insertError}=await db.from('crypto_shadow_signal_monitors').insert(row);if(insertError){if(String(insertError.code)==='23505')duplicates++;else throw insertError}else inserted++;
 }
 return{inserted,duplicates,runs:(runs||[]).length};
}
async function fetchBars(symbol:string,start:number){let lastError:unknown;for(const base of BINANCE){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const startTime=Math.max(Date.now()-6*60*60*1000,start-60000),response=await fetch(`${base}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&startTime=${startTime}&limit=1000`,{signal:controller.signal});clearTimeout(timer);if(!response.ok)throw new Error(`Binance ${response.status}`);const raw=await response.json();return(Array.isArray(raw)?raw:[]).map((x:any)=>({openTime:+x[0],high:+x[2],low:+x[3],close:+x[4],closeTime:+x[6]})).filter((x:any)=>[x.openTime,x.high,x.low,x.close,x.closeTime].every(Number.isFinite))}catch(error){clearTimeout(timer);lastError=error}}throw lastError||new Error('Binance unavailable')}
function overlaps(low:number,high:number,a:number,b:number){return low<=Math.max(a,b)&&high>=Math.min(a,b)}
function ttlMs(tf:string){return tf==='5M'?6*60*60*1000:tf==='1H'?24*60*60*1000:72*60*60*1000}

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'POST only'},405);if(!SECRET||req.headers.get('x-monitor-secret')!==SECRET)return json({error:'Unauthorized'},401);
 try{
  const ingest=await ingestShadowCandidates();const{data:signals,error}=await db.from('crypto_shadow_signal_monitors').select('*').in('status',['WAITING','ACTIVE']).order('created_at',{ascending:true}).limit(500);if(error)throw error;
  const groups=new Map<string,any[]>();for(const signal of signals||[]){const pair=`${signal.symbol}USDT`;if(!groups.has(pair))groups.set(pair,[]);groups.get(pair)!.push(signal)}
  let checked=0,transitioned=0,closed=0,expired=0;const errors:string[]=[];
  for(const[pair,list]of groups){let bars:any[]=[];try{const start=Math.min(...list.map(signal=>new Date(signal.last_checked_at||signal.created_at).getTime()));bars=await fetchBars(pair,start)}catch(error){errors.push(`${pair}: ${error instanceof Error?error.message:String(error)}`);continue}
   for(const signal of list){checked++;let status=signal.status,stage=signal.management_stage||'ORIGINAL',tp1Reached=!!signal.tp1_reached,tp2Reached=!!signal.tp2_reached,tp3Reached=!!signal.tp3_reached,entryAt=signal.entry_at,tp1At=signal.tp1_at,tp2At=signal.tp2_at,tp3At=signal.tp3_at,closeType=signal.close_type,closedAt=signal.closed_at,managedStop=finite(signal.managed_stop)??finite(signal.initial_stop)!,lastPrice=finite(signal.last_price);const long=signal.direction==='LONG',entryLow=Number(signal.entry_low),entryHigh=Number(signal.entry_high),mid=(entryLow+entryHigh)/2,initialStop=Number(signal.initial_stop),tp1=Number(signal.tp1),tp2=finite(signal.tp2),tp3=finite(signal.tp3),since=new Date(signal.last_checked_at||signal.created_at).getTime();
    if(status==='WAITING'&&Date.now()-new Date(signal.created_at).getTime()>ttlMs(signal.timeframe)){status='CLOSED';stage='CLOSED';closeType='EXPIRED';closedAt=new Date().toISOString();closed++;expired++}
    else for(const bar of bars.filter(item=>item.closeTime>=since-1000)){lastPrice=bar.close;if(status==='WAITING'){if(overlaps(bar.low,bar.high,entryLow,entryHigh)){status='ACTIVE';entryAt=entryAt||new Date(bar.closeTime).toISOString();managedStop=initialStop;transitioned++}continue}if(status!=='ACTIVE')break;const stopHit=long?bar.low<=managedStop:bar.high>=managedStop;if(stopHit){status='CLOSED';closedAt=new Date(bar.closeTime).toISOString();closeType=stage==='PROTECTED_TP1'?'PROTECTED_TP1':stage==='BREAKEVEN'?'BREAKEVEN':'STOP';closed++;break}const favorable=long?bar.high:bar.low,reaches=(level:number|null)=>level!==null&&(long?favorable>=level:favorable<=level);if(!tp1Reached&&reaches(tp1)){tp1Reached=true;tp1At=new Date(bar.closeTime).toISOString();managedStop=mid;stage='BREAKEVEN';transitioned++}if(!tp2Reached&&reaches(tp2)){tp1Reached=true;tp2Reached=true;tp2At=new Date(bar.closeTime).toISOString();managedStop=tp1;stage='PROTECTED_TP1';transitioned++}if(!tp3Reached&&reaches(tp3)){tp1Reached=true;tp2Reached=tp2Reached||tp2===null;tp3Reached=true;tp3At=new Date(bar.closeTime).toISOString();status='CLOSED';stage='CLOSED';closeType='TP3';closedAt=new Date(bar.closeTime).toISOString();closed++;transitioned++;break}}
    const update={status,management_stage:stage,tp1_reached:tp1Reached,tp2_reached:tp2Reached,tp3_reached:tp3Reached,entry_at:entryAt,tp1_at:tp1At,tp2_at:tp2At,tp3_at:tp3At,closed_at:closedAt,close_type:closeType,managed_stop:managedStop,last_price:lastPrice,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};const{error:updateError}=await db.from('crypto_shadow_signal_monitors').update(update).eq('id',signal.id);if(updateError)errors.push(`${signal.id}: ${updateError.message}`)
   }
  }
  return json({success:true,monitor_version:2,ingest,checked,transitioned,closed,expired,errors:errors.slice(0,30)});
 }catch(error){console.error(error);return json({success:false,error:error instanceof Error?error.message:String(error)},500)}
});
