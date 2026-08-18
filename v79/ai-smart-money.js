'use strict';
(() => {
  if(typeof marketContext!=='function'||window.CryptoAISmartMoneyInstalled)return;
  window.CryptoAISmartMoneyInstalled=true;
  const BASE=marketContext;
  const URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-smart-money';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const TF={'15m':'15M','1h':'1H','4h':'4H','1d':'1D','1w':'1W','1M':'1MO'};
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const compact=v=>{const n=num(v);if(n===null)return'n/a';const a=Math.abs(n);return a>=1e9?(n/1e9).toFixed(2)+'B':a>=1e6?(n/1e6).toFixed(2)+'M':a>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(2)};
  async function smart(symbol,interval){
    let session=null;
    try{session=(await sb.auth.getSession())?.data?.session||SESSION}catch{}
    if(!session?.access_token)return null;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(URL,{method:'POST',signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({symbol,timeframe:TF[interval]||'1H'})});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.supported===false)return null;return j;
    }catch{return null}finally{clearTimeout(timer)}
  }
  marketContext=async function enhancedMarketContext(symbol,interval){
    const [base,sm]=await Promise.all([BASE(symbol,interval),smart(symbol,interval)]);
    if(!sm)return base+'\nSMART MONEY: unavailable/unsupported for this asset; do not infer missing derivatives data.';
    const funding=num(sm.funding_rate),oi=num(sm.open_interest_change_pct),book=num(sm.orderbook_imbalance),whale=num(sm.whale_delta_usd),cvd=num(sm.cvd_usd),taker=num(sm.taker_buy_sell_ratio),top=num(sm.top_position_ratio);
    return base+'\n'+[
      'SMART MONEY source: Binance USDⓈ-M public market data',
      `SMART Money score: ${sm.smart_score??'n/a'}/100`,
      `SMART direction: ${sm.smart_direction??'n/a'}`,
      `SMART data quality: ${sm.data_quality??'partial'}`,
      `Large taker BUY volume: $${compact(sm.whale_buy_usd)}`,
      `Large taker SELL volume: $${compact(sm.whale_sell_usd)}`,
      `Whale/Large-order delta: $${compact(whale)}`,
      `Whale pressure: ${num(sm.whale_pressure)!==null?(num(sm.whale_pressure)*100).toFixed(1)+'%':'n/a'}`,
      `CVD: $${compact(cvd)}`,
      `CVD pressure: ${num(sm.cvd_pressure)!==null?(num(sm.cvd_pressure)*100).toFixed(1)+'%':'n/a'}`,
      `Taker buy/sell ratio: ${taker!==null?taker.toFixed(4):'n/a'}`,
      `Open Interest: $${compact(sm.open_interest_usd)}`,
      `Open Interest change: ${oi!==null?oi.toFixed(3)+'%':'n/a'}`,
      `Funding rate: ${funding!==null?(funding*100).toFixed(5)+'%':'n/a'}`,
      `Order book imbalance: ${book!==null?(book*100).toFixed(1)+'%':'n/a'}`,
      `Top trader position long/short ratio: ${top!==null?top.toFixed(4):'n/a'}`,
      'Interpretation guard: Whale Flow is a proxy for unusually large taker orders, not identified whale wallets. Treat order-book walls as provisional because spoofing/cancellation is possible.'
    ].join('\n');
  };
})();
