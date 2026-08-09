'use strict';
(() => {
  if (!window.CryptoChartTools || typeof drawMain !== 'function' || typeof drawRsi !== 'function') return;
  const tools=window.CryptoChartTools;
  const baseMain=drawMain;
  const baseRsi=drawRsi;

  drawMain=function drawMainWithAnalysisToggles(){
    const saved20=ema20,saved50=ema50,saved200=ema200,savedLevels=marketLevels,savedCandles=candles;
    try{
      if(!tools.enabled('ema')){
        ema20=new Array(saved20.length).fill(null);
        ema50=new Array(saved50.length).fill(null);
        ema200=new Array(saved200.length).fill(null);
      }
      if(!tools.enabled('levels')) marketLevels={support:null,resistance:null};
      if(!tools.enabled('volume')) candles=savedCandles.map(c=>({...c,volume:0}));
      baseMain();
    }finally{
      ema20=saved20;ema50=saved50;ema200=saved200;marketLevels=savedLevels;candles=savedCandles;
    }
    tools.refresh();
  };

  drawRsi=function drawRsiWithToggle(){
    const canvas=document.getElementById('rsi');
    if(!tools.enabled('rsi')){
      if(canvas){const r=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');ctx.clearRect(0,0,Math.max(canvas.width,r.width),Math.max(canvas.height,r.height))}
      return;
    }
    baseRsi();
  };

  document.getElementById('analysisTools')?.addEventListener('click',()=>requestAnimationFrame(draw));
  requestAnimationFrame(draw);
})();