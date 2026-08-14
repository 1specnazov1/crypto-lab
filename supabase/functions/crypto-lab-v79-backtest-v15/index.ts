import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||'';
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const COVERAGE_START='2026-08-13T15:16:46.000Z';
const ALLOWED=new Set(['https://1specnazov1.github.io','http://127.0.0.1:4173','http://localhost:4173']);

function headers(origin:string|null){const o=origin&&ALLOWED.has(origin)?origin:'https://1specnazov1.github.io';return{'Access-Control-Allow-Origin':o,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'}}
function json(body:unknown,status:number,origin:string|null){return new Response(JSON.stringify(body),{status,headers:headers(origin)})}
async function userRpc(auth:string,name:string,args:Record<string,unknown>){const r=await fetch(`${URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:auth,apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify(args)}),d=await r.json().catch(()=>({}));if(!r.ok){const e:any=new Error(d?.message||`${name} failed`);e.status=r.status;throw e}return d}
function finite(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}
function tradeStats(trades:any[]){const wins=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0),gp=wins.reduce((s,t)=>s+t.pnl,0),gl=Math.abs(losses.reduce((s,t)=>s+t.pnl,0));return{count:trades.length,wins:wins.length,losses:losses.length,winRate:trades.length?100*wins.length/trades.length:0,profitFactor:gl?gp/gl:gp?null:0,pnl:trades.reduce((s,t)=>s+t.pnl,0),averageR:trades.length?trades.reduce((s,t)=>s+t.r,0)/trades.length:0}}
async function fetchSignals(from:string,symbol:string,timeframe:string,side:string){const all:any[]=[];for(let page=0;page<10;page++){let q=db.from('crypto_shadow_signals').select('id,source_run_id,scanner_version,strategy_version,symbol,timeframe,direction,setup,strength,entry_low,entry_high,initial_stop,managed_stop,tp1,tp2,tp3,status,management_stage,entry_at,tp1_at,tp2_at,tp3_at,closed_at,close_type,realized_r,created_at,metrics,news').eq('strategy_version',15).gte('created_at',from).order('created_at',{ascending:true}).range(page*1000,page*1000+999);if(symbol!=='ALL')q=q.eq('symbol',symbol);if(timeframe!=='ALL')q=q.eq('timeframe',timeframe);if(side!=='BOTH')q=q.eq('direction',side);const{data,error}=await q;if(error)throw error;all.push(...(data||[]));if((data||[]).length<1000)return all}throw new Error('Exact replay range exceeds 10000 signals')}

Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=='POST')return json({error:'POST required',code:'METHOD_NOT_ALLOWED'},405,origin);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth))return json({error:'Authentication required',code:'AUTH_REQUIRED'},401,origin);
  try{
    const body=await req.json().catch(()=>({}));
    const symbolRaw=String(body.symbol||'ALL').toUpperCase().trim(),symbol=symbolRaw==='ALL'||symbolRaw==='*'?'ALL':symbolRaw.replace(/[^A-Z0-9]/g,'');
    const timeframe=String(body.timeframe||body.interval||'ALL').toUpperCase(),side=String(body.side||'BOTH').toUpperCase();
    const hours=Math.max(1,Math.min(2160,Math.round(Number(body.hours)||168)));
    if(symbol!=='ALL'&&(!symbol||symbol.length>20))return json({error:'Invalid symbol',code:'INVALID_INPUT'},400,origin);
    if(!['ALL','5M','1H','4H'].includes(timeframe)||!['BOTH','LONG','SHORT'].includes(side))return json({error:'Invalid filter',code:'INVALID_INPUT'},400,origin);
    const capital=Math.max(100,Number(body.capital)||10000),riskPct=Math.max(.1,Math.min(10,Number(body.riskPct)||1))/100,fee=Math.max(0,Math.min(1,Number(body.fee)||.05))/100,leverage=Math.max(1,Math.min(100,Number(body.leverage)||3));
    const featureStatus=await userRpc(auth,'get_crypto_feature_status',{p_feature:'backtest'});if(featureStatus?.allowed===false)return json({error:'Daily backtest limit reached',code:'QUOTA_EXCEEDED',quota:featureStatus},429,origin);

    const requestedFrom=Date.now()-hours*3600000,coverageMs=new Date(COVERAGE_START).getTime(),effectiveFrom=Math.max(requestedFrom,coverageMs),coverageTruncated=requestedFrom<coverageMs;
    const rows=await fetchSignals(new Date(effectiveFrom).toISOString(),symbol,timeframe,side);
    let equity=capital,peak=capital,maxDrawdown=0;
    const trades:any[]=[],signals:any[]=[];
    for(const row of rows){
      const entryLow=Number(row.entry_low),entryHigh=Number(row.entry_high),entry=(entryLow+entryHigh)/2,stop=Number(row.initial_stop),risk=Math.abs(entry-stop),tp1=finite(row.tp1),tp2=finite(row.tp2),tp3=finite(row.tp3);
      const signalBase={id:row.id,sourceRunId:row.source_run_id,symbol:row.symbol,timeframe:row.timeframe,dir:row.direction,setup:row.setup||'—',strength:row.strength,status:row.status,managementStage:row.management_stage,createdAt:row.created_at,entryAt:row.entry_at,tp1At:row.tp1_at,tp2At:row.tp2_at,tp3At:row.tp3_at,closedAt:row.closed_at,closeType:row.close_type,entry,entryLow,entryHigh,stop,tp1,tp2,tp3,rawR:finite(row.realized_r),liveEligible:!(row.direction==='SHORT'&&(row.timeframe==='1H'||row.timeframe==='4H'))};
      signals.push(signalBase);
      if(row.status!=='CLOSED'||!row.entry_at||!row.closed_at||!row.close_type||!risk)continue;
      let exit:number|null=null;
      if(row.close_type==='TP3')exit=tp3;
      else if(row.close_type==='PROTECTED_TP1')exit=tp1;
      else if(row.close_type==='BREAKEVEN')exit=entry;
      else if(row.close_type==='STOP')exit=stop;
      if(exit===null||!Number.isFinite(exit))continue;
      const qty=Math.min((equity*riskPct)/risk,(equity*leverage)/entry),actualRisk=qty*risk;if(!(qty>0&&actualRisk>0))continue;
      const gross=(row.direction==='LONG'?exit-entry:entry-exit)*qty,fees=(entry*qty+exit*qty)*fee,pnl=gross-fees,r=pnl/actualRisk;
      equity+=pnl;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak?100*(peak-equity)/peak:0);
      trades.push({...signalBase,entryTime:new Date(row.entry_at).getTime(),exitTime:new Date(row.closed_at).getTime(),exit,reason:row.close_type,qty,pnl,r,equity});
    }
    const quota=await userRpc(auth,'consume_crypto_feature',{p_feature:'backtest'});
    const counts={signals:signals.length,waiting:signals.filter(x=>x.status==='WAITING').length,active:signals.filter(x=>x.status==='ACTIVE').length,expired:signals.filter(x=>x.status==='EXPIRED'||x.closeType==='EXPIRED').length,closed:trades.length,tp1:signals.filter(x=>x.tp1At).length,tp2:signals.filter(x=>x.tp2At).length,tp3:signals.filter(x=>x.tp3At).length,breakeven:signals.filter(x=>x.closeType==='BREAKEVEN').length,protectedProfit:signals.filter(x=>x.closeType==='PROTECTED_TP1').length,stops:signals.filter(x=>x.closeType==='STOP').length};
    return json({ok:true,engine:'SCANNER_V15_EXACT',replay_kind:'PRODUCTION_DECISION_REPLAY',filters:{symbol,timeframe,side,hours},parity:{mode:'EXACT',source:'crypto_shadow_signals',scanner_version:15,coverage_start:COVERAGE_START,requested_from:new Date(requestedFrom).toISOString(),effective_from:new Date(effectiveFrom).toISOString(),coverage_truncated:coverageTruncated,global_top3_preserved:true,production_dedupe_preserved:true,monitor_version:5,management:'TP1->BREAKEVEN; TP2->TP1',live_disabled_directions:['1H_SHORT','4H_SHORT']},quota,result:{engineVersion:15,capital,equity,net:equity-capital,returnPct:(equity/capital-1)*100,maxDrawdown,trades,signals,counts,all:tradeStats(trades),long:tradeStats(trades.filter(t=>t.dir==='LONG')),short:tradeStats(trades.filter(t=>t.dir==='SHORT')),start:effectiveFrom,end:Date.now(),assumptions:['actual-production-top3-decisions','actual-production-dedupe','shadow-monitor-v5-binance-1m','stop-first','TP1->breakeven','TP2->TP1','fees-modeled','no-slippage','no-funding']}},200,origin);
  }catch(error){console.error('crypto-lab-v79-backtest-v15',error);const status=Number((error as any)?.status)||500;return json({error:error instanceof Error?error.message:String(error),code:status===401?'AUTH_REQUIRED':'BACKTEST_V15_ERROR'},status,origin)}
});
