'use strict';
(() => {
  const tools=window.CryptoChartTools;
  if(!tools||typeof tools.drawOverlays!=='function')return;

  const KEY='cryptoChartFibVisualModeV2';
  let fibMode='retracement';
  try{fibMode=localStorage.getItem(KEY)||'retracement'}catch{}
  if(!['retracement','extension'].includes(fibMode))fibMode='retracement';

  const toolbar=document.getElementById('analysisTools');
  const fibButton=toolbar?.querySelector('[data-tool="fib"]');
  if(toolbar&&fibButton&&!document.getElementById('fibMode')){
    const sel=document.createElement('select');
    sel.id='fibMode';
    sel.className='analysis-tool fib-mode';
    sel.setAttribute('aria-label','Fibonacci mode');
    sel.innerHTML='<option value="retracement">FIB AUTO RETR</option><option value="extension">FIB EXT</option>';
    sel.value=fibMode;
    sel.style.cssText='padding:7px 6px;min-width:92px;color:#c7ced8;background:#171c22;border-color:#2b3139;font-weight:800;font-size:10px';
    sel.addEventListener('change',()=>{fibMode=sel.value;try{localStorage.setItem(KEY,fibMode)}catch{};requestAnimationFrame(()=>{try{draw()}catch{}})});
    fibButton.insertAdjacentElement('afterend',sel);
  }

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
    if(fibMode==='extension'){
      const dir=z.up?1:-1;
      return [1.272,1.618,2].map(r=>({r,v:z.start+dir*z.range*r}));
    }
    return [.382,.5,.618,.786].map(r=>({r,v:z.up?z.end-z.range*r:z.end+z.range*r}));
  }
  function updateFibSummary(z,levels){
    const body=document.getElementById('technicalAnalysisBody');
    const row=[...(body?.querySelectorAll('.analysis-row')||[])].find(x=>x.querySelector('b')?.textContent==='FIB');
    if(!row)return;
    const span=row.querySelector('span');if(!span)return;
    const last=typeof candles!=='undefined'&&candles.length?candles.at(-1).close:null;
    const nearest=Number.isFinite(last)?levels.reduce((a,b)=>Math.abs(b.v-last)<Math.abs(a.v-last)?b:a,levels[0]):levels[0];
    span.textContent=`AUTO SWING ${z.up?'↑':'↓'} · ${fibMode==='extension'?'EXT':'RETR'} · ${fibRatioLabel(nearest.r)} · ${f(nearest.v)}`;
  }
  function drawFib(env){
    if(!tools.enabled('fib'))return;
    const rows=env?.current?.rows||env?.visible;if(!rows?.length)return;
    const z=autoSwing(rows);if(!z)return;
    const levels=fibLevels(z),{ctx,w,pad,cw,y,x}=env;
    const x1=x(z.startIdx),x2=x(z.endIdx),left=Math.min(x1,x2),baseRight=Math.max(x1,x2),right=Math.min(w-pad.r,baseRight+Math.max(34,cw*.16));
    const current=Number(rows.at(-1)?.close);
    ctx.save();
    ctx.strokeStyle='rgba(123,132,146,.6)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x1,y(z.start));ctx.lineTo(x2,y(z.end));ctx.stroke();ctx.setLineDash([]);
    for(const px of [[x1,y(z.start)],[x2,y(z.end)]]){ctx.fillStyle='#f0b90b';ctx.beginPath();ctx.arc(px[0],px[1],3,0,Math.PI*2);ctx.fill()}
    levels.forEach(({r,v})=>{
      const yy=y(v),isSupport=Number.isFinite(current)?v<=current:null;
      const color=isSupport===null?'#8b96a5':isSupport?'#0ecb81':'#f6465d';
      ctx.strokeStyle=color;ctx.globalAlpha=.88;ctx.lineWidth=1.25;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();ctx.globalAlpha=1;
      const label=`${fibRatioLabel(r)} · ${f(v)}`;
      ctx.font='bold 9px system-ui';const tw=ctx.measureText(label).width+10;
      const lx=Math.max(left+3,Math.min(right-tw,w-pad.r-tw-3));
      ctx.fillStyle='rgba(11,14,17,.92)';ctx.fillRect(lx,yy-13,tw,13);
      ctx.strokeStyle=color;ctx.strokeRect(lx+.5,yy-12.5,tw-1,12);
      ctx.fillStyle=color;ctx.fillText(label,lx+5,yy-4);
    });
    const swingText=`AUTO SWING ${z.up?'LOW → HIGH':'HIGH → LOW'} · ${fibMode==='extension'?'EXTENSION':'RETRACEMENT'}`;
    ctx.font='bold 9px system-ui';ctx.fillStyle='#9aa4b2';ctx.fillText(swingText,left+3,Math.max(pad.t+11,Math.min(y(z.start),y(z.end))-8));
    ctx.restore();
    updateFibSummary(z,levels);
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
    const {ctx,w,pad,y}=env;const minGap=15;
    items.forEach(o=>o.actual=y(o.v));items.sort((a,b)=>a.actual-b.actual);
    items.forEach((o,i)=>{o.yy=i?Math.max(o.actual,items[i-1].yy+minGap):o.actual});
    const bottom=(env.h||500)-pad.b-9;
    for(let i=items.length-1;i>=0;i--){if(items[i].yy>bottom)items[i].yy=bottom;if(i<items.length-1&&items[i].yy>items[i+1].yy-minGap)items[i].yy=items[i+1].yy-minGap}
    ctx.save();ctx.font='bold 9px system-ui';
    items.forEach(o=>{
      const text=`${o.name} ${f(o.v)}`,tw=ctx.measureText(text).width+10,x0=Math.max(pad.l+4,w-pad.r-tw-7);
      ctx.strokeStyle=o.color;ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(x0-14,o.actual);ctx.lineTo(x0-3,o.yy);ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle='rgba(11,14,17,.9)';ctx.fillRect(x0,o.yy-8,tw,14);ctx.strokeStyle=o.color;ctx.strokeRect(x0,o.yy-8,tw,14);ctx.fillStyle=o.color;ctx.fillText(text,x0+5,o.yy+2);
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
