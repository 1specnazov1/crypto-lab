'use strict';
(() => {
  const tools=window.CryptoChartTools;
  if(!tools||typeof tools.drawOverlays!=='function')return;

  const RETRACEMENT_LEVELS=[.382,.5,.618,.786];
  const EXTENSION_LEVELS=[1.272,1.618,2];

  function f(v){try{return typeof fmt==='function'?fmt(v):Number(v).toFixed(2)}catch{return String(v)}}
  function fibRatioLabel(r){
    if(r===.382)return '0.382';
    if(r===.5)return '0.5';
    if(r===.618)return '0.618';
    if(r===.786)return '0.786';
    if(r===1.272)return '1.272';
    if(r===1.618)return '1.618';
    if(r===2)return '2.0';
    return String(r);
  }
  function localPivots(rows,w=3){
    const out=[];
    for(let i=w;i<rows.length-w;i++){
      let hi=true,lo=true;
      for(let j=i-w;j<=i+w;j++){
        if(j===i)continue;
        if(rows[j].high>rows[i].high)hi=false;
        if(rows[j].low<rows[i].low)lo=false;
      }
      if(hi)out.push({i,type:'H',p:rows[i].high});
      if(lo)out.push({i,type:'L',p:rows[i].low});
    }
    return out.sort((a,b)=>a.i-b.i);
  }
  function autoSwing(rows){
    if(!rows?.length)return null;
    const piv=localPivots(rows,Math.max(2,Math.min(5,Math.round(rows.length/45))));
    let best=null,bestScore=-1;
    for(let a=0;a<piv.length;a++)for(let b=a+1;b<piv.length;b++){
      const A=piv[a],B=piv[b];if(A.type===B.type)continue;
      const sep=B.i-A.i;if(sep<Math.max(5,rows.length*.035))continue;
      if(B.i<rows.length*.52)continue;
      const range=Math.abs(B.p-A.p);if(!Number.isFinite(range)||range<=0)continue;
      const recency=.7+.3*(B.i/(rows.length-1||1));
      const score=range*Math.sqrt(sep)*recency;
      if(score>bestScore){bestScore=score;best={a:A,b:B}}
    }
    if(!best){
      let hiI=0,loI=0;
      rows.forEach((c,i)=>{if(c.high>rows[hiI].high)hiI=i;if(c.low<rows[loI].low)loI=i});
      const first=loI<hiI?{i:loI,type:'L',p:rows[loI].low}:{i:hiI,type:'H',p:rows[hiI].high};
      const second=loI<hiI?{i:hiI,type:'H',p:rows[hiI].high}:{i:loI,type:'L',p:rows[loI].low};
      best={a:first,b:second};
    }
    const start=best.a,end=best.b,up=end.p>start.p,range=Math.abs(end.p-start.p)||1;
    return {startIdx:start.i,endIdx:end.i,start:start.p,end:end.p,up,range};
  }
  function fibLevels(z){
    const retracement=RETRACEMENT_LEVELS.map(r=>({r,kind:'R',v:z.up?z.end-z.range*r:z.end+z.range*r}));
    const dir=z.up?1:-1;
    const extension=EXTENSION_LEVELS.map(r=>({r,kind:'E',v:z.start+dir*z.range*r}));
    return [...retracement,...extension];
  }
  function fibScaleLevels(rows){
    if(!tools.enabled('fib')||!rows?.length)return [];
    const z=autoSwing(rows);if(!z)return [];
    return fibLevels(z).map(x=>x.v).filter(Number.isFinite);
  }
  window.CryptoFibScaleLevels=fibScaleLevels;

  function updateFibSummary(z,levels,rows){
    const body=document.getElementById('technicalAnalysisBody');
    const row=[...(body?.querySelectorAll('.analysis-row')||[])].find(x=>x.querySelector('b')?.textContent==='FIB');
    if(!row)return;
    const span=row.querySelector('span');if(!span)return;
    const last=Number(rows?.at(-1)?.close);
    const nearest=Number.isFinite(last)?levels.reduce((a,b)=>Math.abs(b.v-last)<Math.abs(a.v-last)?b:a,levels[0]):levels[0];
    span.textContent=`AUTO SWING ${z.up?'↑':'↓'} · RETR+EXT · 7 LEVELS · ${nearest.kind}${fibRatioLabel(nearest.r)} ${f(nearest.v)}`;
  }
  function drawFib(env){
    if(!tools.enabled('fib'))return;
    const rows=env?.current?.rows||env?.visible;if(!rows?.length)return;
    const z=autoSwing(rows);if(!z)return;
    const levels=fibLevels(z),{ctx,w,pad,y,x}=env;
    const x1=x(z.startIdx),x2=x(z.endIdx),chartLeft=pad.l+2,chartRight=w-pad.r-4,current=Number(rows.at(-1)?.close);
    ctx.save();
    ctx.strokeStyle='rgba(132,142,156,.48)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x1,y(z.start));ctx.lineTo(x2,y(z.end));ctx.stroke();ctx.setLineDash([]);
    for(const px of [[x1,y(z.start)],[x2,y(z.end)]]){ctx.fillStyle='#f0b90b';ctx.beginPath();ctx.arc(px[0],px[1],3,0,Math.PI*2);ctx.fill()}
    levels.forEach(({r,v,kind})=>{
      const yy=y(v),isSupport=Number.isFinite(current)?v<=current:true,color=isSupport?'#0ecb81':'#f6465d',textColor=isSupport?'#e8fff7':'#fff0f3';
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=kind==='E'?1.9:1.55;ctx.globalAlpha=kind==='E'?.96:.82;ctx.shadowBlur=kind==='E'?9:6;ctx.shadowColor=color;ctx.setLineDash(kind==='E'?[8,4]:[]);ctx.beginPath();ctx.moveTo(chartLeft,yy);ctx.lineTo(chartRight,yy);ctx.stroke();ctx.restore();
      const label=`${kind} ${fibRatioLabel(r)} · ${f(v)}`;
      ctx.font='bold 10px system-ui';const tw=ctx.measureText(label).width+10,lx=chartRight-tw;
      ctx.fillStyle='rgba(8,11,15,.95)';ctx.fillRect(lx,yy-9,tw,16);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(lx+.5,yy-8.5,tw-1,15);ctx.fillStyle=textColor;ctx.fillText(label,lx+5,yy+3);
    });
    const swingText=`AUTO SWING ${z.up?'LOW → HIGH':'HIGH → LOW'} · RETRACEMENT + EXTENSION`;
    ctx.font='bold 9px system-ui';ctx.fillStyle='#aeb7c4';ctx.fillText(swingText,chartLeft+100,Math.max(pad.t+11,Math.min(y(z.start),y(z.end))-8));
    ctx.restore();
    updateFibSummary(z,levels,rows);
  }
  function drawEmaLabels(env){
    if(!tools.enabled('ema')||typeof ema20==='undefined')return;
    const idx=(env?.offset||0)+(env?.visible?.length||0)-1;if(idx<0)return;
    const items=[
      {name:'EMA20',v:ema20?.[idx],color:'#f0b90b'},
      {name:'EMA50',v:ema50?.[idx],color:'#4d9fff'},
      {name:'EMA200',v:ema200?.[idx],color:'#a86bff'}
    ].filter(o=>Number.isFinite(o.v));
    if(!items.length)return;
    const {ctx,pad,y,h}=env,minGap=17,top=pad.t+12,bottom=(h||500)-pad.b-10,x0=pad.l+8;
    items.forEach(o=>{o.actual=y(o.v);o.yy=Math.max(top,Math.min(bottom,o.actual))});items.sort((a,b)=>a.yy-b.yy);
    for(let i=1;i<items.length;i++)if(items[i].yy-items[i-1].yy<minGap)items[i].yy=items[i-1].yy+minGap;
    for(let i=items.length-2;i>=0;i--)if(items[i+1].yy>bottom||items[i+1].yy-items[i].yy<minGap){items[i+1].yy=Math.min(bottom,items[i+1].yy);items[i].yy=items[i+1].yy-minGap}
    items.forEach(o=>o.yy=Math.max(top,Math.min(bottom,o.yy)));
    ctx.save();ctx.font='bold 10px system-ui';
    items.forEach(o=>{
      const text=`${o.name} ${f(o.v)}`,tw=ctx.measureText(text).width+12;
      ctx.fillStyle='rgba(8,11,15,.95)';ctx.fillRect(x0,o.yy-9,tw,16);ctx.strokeStyle=o.color;ctx.lineWidth=1;ctx.strokeRect(x0+.5,o.yy-8.5,tw-1,15);ctx.fillStyle=o.color;ctx.fillText(text,x0+6,o.yy+3);
      ctx.strokeStyle=o.color;ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(x0+tw+4,o.yy);ctx.lineTo(x0+tw+22,o.actual);ctx.stroke();ctx.globalAlpha=1;
    });
    ctx.restore();
  }

  const base=tools.drawOverlays.bind(tools);
  tools.drawOverlays=function upgradedOverlays(env){
    const hadFib=tools.enabled('fib'),savedFib=tools.state?.fib;
    if(hadFib&&tools.state)tools.state.fib=false;
    try{base(env)}finally{if(tools.state)tools.state.fib=savedFib}
    try{drawFib(env)}catch(e){console.warn('professional fib skipped',e)}
    try{drawEmaLabels(env)}catch(e){console.warn('EMA labels skipped',e)}
  };
  requestAnimationFrame(()=>{try{draw()}catch{}});
})();
