import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SCANNER_VERSION = 12;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MONITOR_SECRET = Deno.env.get("MONITOR_SECRET") ?? "";
const ORIGIN = "https://1specnazov1.github.io";
const BINANCE = ["https://data-api.binance.vision", "https://api.binance.com"];
const VALID_MARKET_SYMBOL = /^[A-Z0-9]{2,20}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-monitor-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TF = "5M" | "1H" | "4H";
type Dir = "LONG" | "SHORT";
type Candle = { open:number; high:number; low:number; close:number; volume:number; closeTime:number };
type Plan = {
  symbol:string; timeframe:TF; direction:Dir; strength:number; score:number;
  entryLow:number; entryHigh:number; stop:number; tp1:number; tp2:number; tp3:number; riskPercent:number;
  qualityScore:number; quality:"A"|"B"|"C"; liquidityRank:number; quoteVolume:number;
};

type RunLog = {
  scanner_version:number;
  started_at:string;
  finished_at:string;
  success:boolean;
  dry_run:boolean;
  symbols_checked:number;
  timeframes:TF[];
  directional_signals:number;
  class_a_found:number;
  class_b_found:number;
  class_c_found:number;
  registered:number;
  duplicates:number;
  telegram_sent:number;
  errors:string[];
  class_a:unknown[];
  duration_ms:number;
};

const TF_MAP: Record<TF,string> = { "5M":"5m", "1H":"1h", "4H":"4h" };
const DEFAULT_TF: TF[] = ["5M","1H","4H"];
const VALID_TF = new Set<TF>(DEFAULT_TF);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body:unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers:{...CORS,"Content-Type":"application/json"} });
}
function msg(error:unknown){ return error instanceof Error ? error.message : String(error); }
function n(value:unknown){ const x=Number(value); return Number.isFinite(x) ? x : null; }
function parseTF(value:unknown):TF[]{
  if(!Array.isArray(value)) return [...DEFAULT_TF];
  const out:TF[]=[];
  for(const item of value){ const tf=String(item).toUpperCase() as TF; if(VALID_TF.has(tf)&&!out.includes(tf)) out.push(tf); }
  return out.length?out:[...DEFAULT_TF];
}

async function saveRun(run:RunLog):Promise<string|null>{
  try{
    const { error } = await admin.from("crypto_scanner_runs").insert(run);
    return error ? error.message : null;
  }catch(error){
    return msg(error);
  }
}

async function binance(path:string):Promise<unknown>{
  let last:unknown = new Error("Binance API unavailable");
  for(const base of BINANCE){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch(base+path,{signal:controller.signal,headers:{Accept:"application/json"}});
      clearTimeout(timer);
      if(!r.ok) throw new Error(`Binance ${r.status}`);
      return await r.json();
    }catch(e){ clearTimeout(timer); last=e; }
  }
  throw last;
}

function ema(values:number[], period:number){
  const k=2/(period+1); const out:number[]=[]; let cur=values[0]??0;
  values.forEach((v,i)=>{ cur=i===0?v:v*k+cur*(1-k); out.push(cur); }); return out;
}
function rsi(values:number[], period=14){
  const out:(number|null)[]=Array(values.length).fill(null); if(values.length<=period) return out;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){ const d=values[i]-values[i-1]; gains+=Math.max(d,0); losses+=Math.max(-d,0); }
  let ag=gains/period, al=losses/period; out[period]=al===0?100:100-100/(1+ag/al);
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1]; ag=(ag*(period-1)+Math.max(d,0))/period; al=(al*(period-1)+Math.max(-d,0))/period;
    out[i]=al===0?100:100-100/(1+ag/al);
  }
  return out;
}
function atr(c:Candle[], period=14){
  const out:number[]=[]; let cur=0;
  c.forEach((x,i)=>{ const prev=i?c[i-1].close:x.open; const tr=Math.max(x.high-x.low,Math.abs(x.high-prev),Math.abs(x.low-prev));
    cur=i===0?tr:i<period?(cur*i+tr)/(i+1):(cur*(period-1)+tr)/period; out.push(cur); });
  return out;
}

async function candles(symbol:string, tf:TF):Promise<Candle[]>{
  const raw=await binance(`/api/v3/klines?symbol=${symbol}USDT&interval=${TF_MAP[tf]}&limit=300`);
  if(!Array.isArray(raw)) throw new Error("invalid Binance response");
  const now=Date.now();
  const out:Candle[] = raw.filter((r)=>Array.isArray(r)&&r.length>=7&&Number(r[6])<=now).map((r:any[])=>({
    open:Number(r[1]), high:Number(r[2]), low:Number(r[3]), close:Number(r[4]), volume:Number(r[5]), closeTime:Number(r[6])
  })).filter((x)=>[x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)&&x.close>0);
  if(out.length<220) throw new Error("недостаточно истории");
  return out;
}

async function topMarkets(limit:number){
  const raw=await binance("/api/v3/ticker/24hr");
  if(!Array.isArray(raw)) throw new Error("market list unavailable");
  const excluded=new Set(["USDC","FDUSD","TUSD","USDP","DAI","EUR","TRY","BRL","BIDR","AEUR","USD1"]);
  return raw.map((x:any)=>({pair:String(x?.symbol??""),quoteVolume:Number(x?.quoteVolume)}))
    .filter((x)=>x.pair.endsWith("USDT")&&Number.isFinite(x.quoteVolume)&&x.quoteVolume>0)
    .map((x)=>({symbol:x.pair.slice(0,-4),quoteVolume:x.quoteVolume}))
    .filter((x)=>VALID_MARKET_SYMBOL.test(x.symbol))
    .filter((x)=>!excluded.has(x.symbol)&&!/(UP|DOWN|BULL|BEAR)$/.test(x.symbol))
    .sort((a,b)=>b.quoteVolume-a.quoteVolume).slice(0,limit);
}

function build(c:Candle[], symbol:string, timeframe:TF):Omit<Plan,"qualityScore"|"quality"|"liquidityRank"|"quoteVolume">|null{
  const closes=c.map(x=>x.close), volumes=c.map(x=>x.volume), last=c.at(-1)!; const i=c.length-1;
  const e20=ema(closes,20)[i], e50=ema(closes,50)[i], e200=ema(closes,200)[i];
  const rv=rsi(closes,14)[i], av=atr(c,14)[i]; if(rv===null||![e20,e50,e200,av].every(Number.isFinite)||av<=0) return null;
  const recent=c.slice(-40), support=Math.min(...recent.map(x=>x.low)), resistance=Math.max(...recent.map(x=>x.high));
  const pv=volumes.slice(-21,-1), avg=pv.reduce((a,b)=>a+b,0)/Math.max(1,pv.length)||last.volume;
  const vr=last.volume/avg, momentum=(last.close/closes[closes.length-11]-1)*100;
  let score=0; score+=last.close>e20?1:-1; score+=e20>e50?1.5:-1.5; score+=e50>e200?1.25:-1.25;
  score+=rv>=52&&rv<=70?1:rv>=30&&rv<=48?-1:rv>72?-.25:rv<28?.25:0; score+=momentum>=0?1:-1;
  if(vr>1.2) score+=momentum>=0?.75:-.75;
  const direction:Dir|null=score>=3?"LONG":score<=-3?"SHORT":null; if(!direction) return null;
  const long=direction==="LONG", aligned=long?(last.close>e20&&e20>e50&&e50>e200):(last.close<e20&&e20<e50&&e50<e200);
  const atrPct=av/last.close*100, ext=Math.abs(last.close-e20)/av;
  const rsiQ=long?(rv>=52&&rv<=66?7:rv>=48&&rv<=72?3:rv>72?-8:-4):(rv>=34&&rv<=48?7:rv>=28&&rv<=52?3:rv<28?-8:-4);
  const volQ=vr>=1.5?6:vr>=1.1?4:vr>=.8?1:vr<.6?-5:-2;
  const strength=Math.max(55,Math.min(89,Math.round(50+Math.max(0,Math.abs(score)-3)*5+rsiQ+volQ+(aligned?7:2)+((long&&momentum>0)||(!long&&momentum<0)?4:-4)+(ext<=1?3:ext<=1.6?0:ext<=2.2?-4:-8)+(atrPct<=.15?-3:atrPct>8?-5:atrPct>5?-2:2))));
  const entryLow=long?last.close-av*.35:last.close-av*.1, entryHigh=long?last.close+av*.1:last.close+av*.35, entry=(entryLow+entryHigh)/2;
  const rawStop=long?Math.max(av*1.5,entry-support+av*.15):Math.max(av*1.5,resistance-entry+av*.15), dist=Math.min(rawStop,av*3);
  const stop=long?entry-dist:entry+dist, risk=Math.abs(entry-stop); if(!Number.isFinite(risk)||risk<=0||entry<=0) return null;
  const s=long?1:-1;
  return {symbol,timeframe,direction,strength,score,entryLow:Math.min(entryLow,entryHigh),entryHigh:Math.max(entryLow,entryHigh),stop,tp1:entry+s*risk,tp2:entry+s*risk*1.8,tp3:entry+s*risk*2.8,riskPercent:risk/entry*100};
}

function qualify(base:Omit<Plan,"qualityScore"|"quality"|"liquidityRank"|"quoteVolume">, rank:number,total:number,quoteVolume:number):Plan{
  const bonus=total>1?Math.round((total-rank)/(total-1)*6):3, qualityScore=Math.min(99,base.strength+bonus);
  return {...base,qualityScore,quality:qualityScore>=88?"A":qualityScore>=77?"B":"C",liquidityRank:rank,quoteVolume};
}

async function edge(name:string, body:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/${name}`,{
    method:"POST",
    headers:{Authorization:`Bearer ${SERVICE_ROLE_KEY}`,apikey:SERVICE_ROLE_KEY,"Content-Type":"application/json",Origin:ORIGIN,"x-monitor-secret":MONITOR_SECRET},
    body:JSON.stringify(body),
  });
  const result=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(String(result?.error??result?.message??`${name} ${r.status}`));
  return result;
}

function price(v:number){ return v>=1000?v.toLocaleString("en-US",{maximumFractionDigits:0}):v>=1?v.toLocaleString("en-US",{maximumFractionDigits:4}):v.toLocaleString("en-US",{maximumFractionDigits:8}); }
async function register(p:Plan){ return await edge("crypto-signal-register",{p_symbol:p.symbol,p_timeframe:p.timeframe,p_direction:p.direction,p_strength:Math.round(p.qualityScore),p_entry_low:p.entryLow,p_entry_high:p.entryHigh,p_stop:p.stop,p_tp1:p.tp1,p_tp2:p.tp2,p_tp3:p.tp3}); }
async function telegram(p:Plan){ return await edge("crypto-telegram-signal",{symbol:p.symbol,timeframe:p.timeframe,direction:p.direction,strength:Math.round(p.qualityScore),entry:`${price(p.entryLow)} – ${price(p.entryHigh)}`,stop:price(p.stop),tp1:price(p.tp1),tp2:price(p.tp2),tp3:price(p.tp3),risk:`до Stop ${p.riskPercent.toFixed(2)}% · класс A · сервер 24/7`,url:"https://1specnazov1.github.io/crypto-lab/#marketScanner"}); }

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({error:"POST only"},405);
  if(!MONITOR_SECRET||req.headers.get("x-monitor-secret")!==MONITOR_SECRET) return json({error:"Недействительный ключ"},401);
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY) return json({error:"Supabase configuration unavailable"},500);

  const started=Date.now();
  const startedAt=new Date(started).toISOString();
  let dry=false;
  let tfs:TF[]=[...DEFAULT_TF];
  let symbolsChecked=0;

  try{
    const input=await req.json().catch(()=>({}));
    const limit=Math.max(5,Math.min(20,Math.round(n(input?.limit)??20)));
    tfs=parseTF(input?.timeframes);
    dry=input?.dry_run===true;

    const markets=await topMarkets(limit), plans:Plan[]=[], errors:string[]=[]; let next=0;
    symbolsChecked=markets.length;
    async function worker(){ while(true){ const idx=next++; if(idx>=markets.length) return; const m=markets[idx]; for(const tf of tfs){ try{ const b=build(await candles(m.symbol,tf),m.symbol,tf); if(b) plans.push(qualify(b,idx+1,markets.length,m.quoteVolume)); }catch(e){ errors.push(`${m.symbol} ${tf}: ${msg(e)}`); } } } }
    await Promise.all(Array.from({length:Math.min(4,markets.length)},()=>worker()));

    const classAAll=plans.filter(p=>p.quality==="A");
    const classBCount=plans.filter(p=>p.quality==="B").length;
    const classCCount=plans.filter(p=>p.quality==="C").length;
    const classA=[...classAAll].sort((a,b)=>b.qualityScore-a.qualityScore||Math.abs(b.score)-Math.abs(a.score)).slice(0,5);
    let registered=0,duplicates=0,telegramSent=0; const processing:string[]=[];
    if(!dry){ for(const p of classA){ try{ const r=await register(p); if(r?.inserted===true){ registered++; try{ await telegram(p); telegramSent++; }catch(e){ processing.push(`${p.symbol} ${p.timeframe} Telegram: ${msg(e)}`); } } else duplicates++; }catch(e){ processing.push(`${p.symbol} ${p.timeframe}: ${msg(e)}`); } } }

    const classASafe=classA.map(p=>({symbol:p.symbol,timeframe:p.timeframe,direction:p.direction,strength:p.qualityScore,entry_low:p.entryLow,entry_high:p.entryHigh,stop:p.stop,tp1:p.tp1,tp2:p.tp2,tp3:p.tp3}));
    const allErrors=[...errors,...processing].slice(0,30);
    const durationMs=Date.now()-started;
    const logError=await saveRun({
      scanner_version:SCANNER_VERSION,
      started_at:startedAt,
      finished_at:new Date().toISOString(),
      success:true,
      dry_run:dry,
      symbols_checked:markets.length,
      timeframes:tfs,
      directional_signals:plans.length,
      class_a_found:classAAll.length,
      class_b_found:classBCount,
      class_c_found:classCCount,
      registered,
      duplicates,
      telegram_sent:telegramSent,
      errors:allErrors,
      class_a:classASafe,
      duration_ms:durationMs,
    });

    return json({success:true,scanner_version:SCANNER_VERSION,dry_run:dry,symbols_checked:markets.length,timeframes:tfs,directional_signals:plans.length,class_a_found:classAAll.length,class_b_found:classBCount,class_c_found:classCCount,registered,duplicates,telegram_sent:telegramSent,class_a:classASafe,errors:allErrors,duration_ms:durationMs,run_logged:!logError,...(logError?{run_log_error:logError}:{})});
  }catch(e){
    const error=msg(e);
    const durationMs=Date.now()-started;
    const logError=await saveRun({
      scanner_version:SCANNER_VERSION,
      started_at:startedAt,
      finished_at:new Date().toISOString(),
      success:false,
      dry_run:dry,
      symbols_checked:symbolsChecked,
      timeframes:tfs,
      directional_signals:0,
      class_a_found:0,
      class_b_found:0,
      class_c_found:0,
      registered:0,
      duplicates:0,
      telegram_sent:0,
      errors:[error],
      class_a:[],
      duration_ms:durationMs,
    });
    return json({success:false,scanner_version:SCANNER_VERSION,error,duration_ms:durationMs,run_logged:!logError,...(logError?{run_log_error:logError}:{})},500);
  }
});