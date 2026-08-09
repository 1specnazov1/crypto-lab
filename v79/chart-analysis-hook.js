'use strict';
(() => {
  if (!window.CryptoChartTools || typeof drawMain !== 'function' || typeof drawRsi !== 'function') return;
  const tools=window.CryptoChartTools;
  const baseMain=drawMain;
  const baseRsi=drawRsi;

  function overlayEnv(){
    const chart=document.getElementById('chart');if(!chart||!candles?.length)return null;
    const {ctx,w,h}=fitCanvas(chart),pad={l:12,r:82,t:20,b:42},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
    const requested=Number(storageGet('cryptoChartVisibleCandles'))||120,count=Math.max(24,Math.min(candles.length,requested));
    const visible=candles.slice(-count),offset=candles.length-visible.length;
    const levels=[marketLevels.support,marketLevels.resistance,signal.entryLow,signal.entryHigh,signal.stop,signal.tp1,signal.tp2,signal.tp3].filter(Number.isFinite);
    let min=Math.min(...visible.map(c=>c.low),...levels),max=Math.max(...visible.map(c=>c.high),...levels);const margin=(max-min||1)*.07;min-=margin;max+=margin;
    const y=v=>pad.t+(max-v)/(max-min||1)*ch,x=i=>pad.l+(i+.5)/visible.length*cw;
    return {ctx,w,h,pad,cw,ch,current:{rows:visible,start:offset,end:candles.length},visible,offset,y,x};
  }

  drawMain=function drawMainWithAnalysisToggles(){
    const saved20=ema20,saved50=ema50,saved200=ema200,savedLevels=marketLevels,savedCandles=candles;
    const proto=globalThis.CanvasRenderingContext2D?.prototype,baseFill=proto?.fillText,baseMeasure=proto?.measureText;
    const supportText=Number.isFinite(savedLevels?.support)?`S ${fmt(savedLevels.support)}`:'S';
    const resistanceText=Number.isFinite(savedLevels?.resistance)?`R ${fmt(savedLevels.resistance)}`:'R';
    try{
      if(proto&&baseFill&&baseMeasure){
        proto.fillText=function(text,...args){const t=text==='S'?supportText:text==='R'?resistanceText:text;return baseFill.call(this,t,...args)};
        proto.measureText=function(text){const t=text==='S'?supportText:text==='R'?resistanceText:text;return baseMeasure.call(this,t)};
      }
      if(!tools.enabled('ema')){ema20=new Array(saved20.length).fill(null);ema50=new Array(saved50.length).fill(null);ema200=new Array(saved200.length).fill(null)}
      if(!tools.enabled('levels')) marketLevels={support:null,resistance:null};
      if(!tools.enabled('volume')) candles=savedCandles.map(c=>({...c,volume:0}));
      baseMain();
    }finally{
      if(proto&&baseFill&&baseMeasure){proto.fillText=baseFill;proto.measureText=baseMeasure}
      ema20=saved20;ema50=saved50;ema200=saved200;marketLevels=savedLevels;candles=savedCandles;
    }
    try{const env=overlayEnv();if(env&&typeof tools.drawOverlays==='function')tools.drawOverlays(env)}catch(e){console.warn('analysis overlay skipped',e)}
    tools.refresh();
  };

  drawRsi=function drawRsiWithToggle(){
    const canvas=document.getElementById('rsi');
    if(!tools.enabled('rsi')){if(canvas){const r=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');ctx.clearRect(0,0,Math.max(canvas.width,r.width),Math.max(canvas.height,r.height))}return}
    baseRsi();
  };

  document.getElementById('analysisTools')?.addEventListener('click',()=>requestAnimationFrame(draw));
  requestAnimationFrame(draw);
})();