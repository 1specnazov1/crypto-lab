'use strict';
(() => {
  if (!window.CryptoChartTools || typeof drawMain !== 'function' || typeof drawRsi !== 'function') return;
  const tools=window.CryptoChartTools;
  const baseMain=drawMain;
  const baseRsi=drawRsi;

  function env(){
    const canvas=document.getElementById('chart');
    if(!canvas||!Array.isArray(candles)||!candles.length)return null;
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const ctx=canvas.getContext('2d');
    const w=canvas.width/dpr,h=canvas.height/dpr;
    if(!ctx||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return null;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const pad={l:12,r:82,t:20,b:42},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
    let current=null;
    try{current=typeof window.CryptoChartViewport==='function'?window.CryptoChartViewport():null}catch{}
    if(!current?.rows?.length){
      const requested=Number(storageGet('cryptoChartVisibleCandles'))||120;
      const count=Math.max(24,Math.min(candles.length,requested));
      const visible=candles.slice(-count),offset=candles.length-visible.length;
      current={rows:visible,start:offset,end:candles.length,count:visible.length};
    }
    const visible=current.rows,offset=current.start;
    const fibLevels=typeof window.CryptoFibScaleLevels==='function'?window.CryptoFibScaleLevels(visible):[];
    const levels=[marketLevels.support,marketLevels.resistance,signal.entryLow,signal.entryHigh,signal.stop,signal.tp1,signal.tp2,signal.tp3,...fibLevels].filter(Number.isFinite);
    let min=Math.min(...visible.map(c=>c.low),...levels),max=Math.max(...visible.map(c=>c.high),...levels);
    const margin=(max-min||1)*.07;min-=margin;max+=margin;
    const y=v=>pad.t+(max-v)/(max-min||1)*ch,x=i=>pad.l+(i+.5)/visible.length*cw;
    return {ctx,w,h,pad,cw,ch,current,visible,offset,y,x,min,max};
  }

  function priceLabel(ctx,w,pad,y,value,prefix,color){
    if(!Number.isFinite(value))return;
    const text=`${prefix} ${fmt(value)}`;
    ctx.save();ctx.font='bold 9px system-ui';
    const width=Math.max(72,ctx.measureText(text).width+12),xx=w-pad.r+4,yy=y(value);
    ctx.fillStyle=color;ctx.fillRect(xx,yy-8,width,16);
    ctx.fillStyle='#0b0e11';ctx.fillText(text,xx+6,yy+3);ctx.restore();
  }

  drawMain=function drawMainWithAnalysisToggles(){
    const saved20=ema20,saved50=ema50,saved200=ema200,savedLevels=marketLevels,savedCandles=candles;
    try{
      if(!tools.enabled('ema')){ema20=new Array(saved20.length).fill(null);ema50=new Array(saved50.length).fill(null);ema200=new Array(saved200.length).fill(null)}
      if(!tools.enabled('levels'))marketLevels={support:null,resistance:null};
      if(!tools.enabled('volume'))candles=savedCandles.map(c=>({...c,volume:0}));
      baseMain();
    }finally{
      ema20=saved20;ema50=saved50;ema200=saved200;marketLevels=savedLevels;candles=savedCandles;
    }
    try{
      const e=env();
      if(e&&tools.enabled('levels')){
        priceLabel(e.ctx,e.w,e.pad,e.y,savedLevels.support,'S','#4d9fff');
        priceLabel(e.ctx,e.w,e.pad,e.y,savedLevels.resistance,'R','#f0b90b');
      }
      if(e&&typeof tools.drawOverlays==='function')tools.drawOverlays(e);
    }catch(error){console.warn('analysis overlay skipped',error)}
    tools.refresh();
  };

  drawRsi=function drawRsiWithToggle(){
    const canvas=document.getElementById('rsi');
    if(!tools.enabled('rsi')){
      if(canvas){const {ctx,w,h}=fitCanvas(canvas);ctx.clearRect(0,0,w,h)}
      return;
    }
    baseRsi();
  };

  document.getElementById('analysisTools')?.addEventListener('click',()=>requestAnimationFrame(draw));
  requestAnimationFrame(draw);
})();
