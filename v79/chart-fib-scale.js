'use strict';
(() => {
  if(typeof drawMain!=='function')return;
  drawMain=function drawMainWithFibScale(){
    const {ctx,w,h}=fitCanvas($('chart'));ctx.clearRect(0,0,w,h);
    const pad={l:10,r:72,t:18,b:24},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,visible=candles.slice(-140),offset=candles.length-visible.length;
    const fibLevels=typeof window.CryptoFibScaleLevels==='function'?window.CryptoFibScaleLevels(visible):[];
    const levels=[marketLevels.support,marketLevels.resistance,signal.entryLow,signal.entryHigh,signal.stop,signal.tp1,signal.tp2,signal.tp3,...fibLevels].filter(Number.isFinite);
    let min=Math.min(...visible.map(c=>c.low),...levels),max=Math.max(...visible.map(c=>c.high),...levels);const margin=(max-min||1)*.06;min-=margin;max+=margin;
    const y=v=>pad.t+(max-v)/(max-min||1)*ch,x=i=>pad.l+(i+.5)/visible.length*cw;
    ctx.strokeStyle='#20262d';ctx.lineWidth=1;ctx.font='10px system-ui';ctx.fillStyle='#848e9c';for(let i=0;i<=5;i++){const yy=pad.t+i/5*ch,val=max-i/5*(max-min);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(fmt(val),w-pad.r+7,yy+3)}
    if(Number.isFinite(signal.entryLow)&&Number.isFinite(signal.entryHigh)){ctx.fillStyle='rgba(240,185,11,.10)';const y1=y(Math.max(signal.entryLow,signal.entryHigh)),y2=y(Math.min(signal.entryLow,signal.entryHigh));ctx.fillRect(pad.l,y1,cw,y2-y1)}
    const bar=Math.max(2,cw/visible.length*.68);visible.forEach((c,i)=>{const xx=x(i),up=c.close>=c.open,col=up?'#0ecb81':'#f6465d';ctx.strokeStyle=col;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(xx,y(c.high));ctx.lineTo(xx,y(c.low));ctx.stroke();const top=Math.min(y(c.open),y(c.close)),height=Math.max(1,Math.abs(y(c.open)-y(c.close)));ctx.fillRect(xx-bar/2,top,bar,height)});
    function line(values,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();visible.forEach((c,i)=>{const v=values[offset+i];if(!Number.isFinite(v))return;const xx=x(i),yy=y(v);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)});ctx.stroke()}
    line(ema20,'#f0b90b',1.2);line(ema50,'#4d9fff',1.2);line(ema200,'#a86bff',1.2);
    function hline(v,color,label,dash=[]){if(!Number.isFinite(v))return;const yy=y(v);ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.setLineDash([]);ctx.fillRect(w-pad.r+4,yy-8,64,16);ctx.fillStyle='#0b0e11';ctx.font='bold 9px system-ui';ctx.fillText(label,w-pad.r+8,yy+3);ctx.restore()}
    hline(marketLevels.support,'#4d9fff','S',[5,4]);hline(marketLevels.resistance,'#f0b90b','R',[5,4]);hline(signal.stop,'#f6465d','STOP');hline(signal.tp1,'#0ecb81','TP1');hline(signal.tp2,'#0ecb81','TP2');hline(signal.tp3,'#0ecb81','TP3');
    const maxVol=Math.max(...visible.map(c=>c.volume),1),vh=ch*.18;visible.forEach((c,i)=>{ctx.fillStyle=c.close>=c.open?'rgba(14,203,129,.25)':'rgba(246,70,93,.25)';const hh=c.volume/maxVol*vh;ctx.fillRect(x(i)-bar/2,pad.t+ch-hh,bar,hh)});
    ctx.strokeStyle='#2b3139';ctx.beginPath();ctx.moveTo(pad.l,pad.t+ch);ctx.lineTo(w-pad.r,pad.t+ch);ctx.stroke();
  };
})();
