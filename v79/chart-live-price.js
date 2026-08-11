'use strict';
(() => {
  if(window.CryptoChartLivePriceGuard)return;
  const state={price:null,verifiedAt:0,status:'checking',sources:[],raw:null};
  window.CryptoChartLivePriceGuard=state;
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
  function valid(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
  function rel(a,b){return Math.abs(a-b)/Math.max(Math.abs(a),Math.abs(b),1)}
  async function sample(){
    const pair=String(symbol||'BTC').toUpperCase().replace(/USDT$/,'')+'USDT';
    const paths=[
      `/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`,
      `/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`,
      `/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(tf)}&limit=1`
    ];
    const [spotR,dayR,klineR]=await Promise.allSettled(paths.map(p=>api(p)));
    const spot=spotR.status==='fulfilled'?valid(spotR.value?.price):null;
    const day=dayR.status==='fulfilled'?valid(dayR.value?.lastPrice):null;
    const klineRows=klineR.status==='fulfilled'&&Array.isArray(klineR.value)?klineR.value:[];
    const kline=valid(klineRows.at(-1)?.[4]);
    const values=[['ticker/price',spot],['ticker/24hr',day],['open-kline',kline]].filter(([,v])=>Number.isFinite(v));
    if(values.length<2)throw new Error('Binance price consensus unavailable');
    const sorted=values.map(([,v])=>v).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
    const agreeing=values.filter(([,v])=>rel(v,median)<=0.003);
    if(agreeing.length<2)throw new Error('Binance price sources disagree');
    const spotAgrees=Number.isFinite(spot)&&agreeing.some(([name])=>name==='ticker/price');
    const canonical=spotAgrees?spot:agreeing.map(([,v])=>v).sort((a,b)=>a-b)[Math.floor(agreeing.length/2)];
    return {price:canonical,sources:agreeing.map(([name])=>name),raw:{spot,day,kline}};
  }
  async function verify(){
    try{
      let result=await sample();
      if(result.raw.spot&&result.raw.day&&rel(result.raw.spot,result.raw.day)>.003){await sleep(300);result=await sample()}
      state.price=result.price;state.verifiedAt=Date.now();state.status='verified';state.sources=result.sources;state.raw=result.raw;
      window.CryptoChartLivePrice=result.price;
      window.CryptoChartLivePriceVerifiedAt=state.verifiedAt;
      const p=document.getElementById('lastPrice');if(p)p.textContent='$'+fmt(result.price);
      const text=document.getElementById('liveText');if(text)text.textContent=tr().live;
      const dot=document.getElementById('liveDot');if(dot)dot.className='dot';
      requestAnimationFrame(()=>{try{draw()}catch{}});
    }catch(error){
      state.status='mismatch';state.sources=[];
      const age=Date.now()-state.verifiedAt;
      if(age>60000){state.price=null;state.raw=null;window.CryptoChartLivePrice=null;const p=document.getElementById('lastPrice');if(p)p.textContent='—';const dot=document.getElementById('liveDot');if(dot)dot.className='dot bad'}
      const text=document.getElementById('liveText');if(text)text.textContent=lang==='uk'?'Binance · перевірка ціни':lang==='en'?'Binance · verifying price':'Binance · проверка цены';
      console.warn('Binance live price verification',error?.message||error);
    }
  }
  verify();setInterval(()=>{if(!document.hidden)verify()},8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify()});
})();
