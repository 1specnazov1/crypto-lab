'use strict';
(() => {
  const root = document.querySelector('.top');
  const apply = document.getElementById('apply');
  const side = document.querySelector('.side');
  if (!root || !apply || !side) return;

  const defs = [
    ['ema','EMA'],['fib','FIB'],['rsi','RSI'],['macd','MACD'],['bb','BB'],['vwap','VWAP'],['atr','ATR'],['levels','S/R'],['volume','VOL'],['trend','TREND']
  ];
  const defaults = {ema:true,fib:false,rsi:true,macd:false,bb:false,vwap:false,atr:false,levels:true,volume:true,trend:true};
  const KEY='cryptoChartAnalysisToolsV1';
  let state={...defaults};
  try { state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}; } catch {}
  let lastSignature='';

  const css=document.createElement('style');
  css.id='chartAnalysisToolsStyles';
  css.textContent=`
    .analysis-tools{display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:min(820px,100%)}
    .analysis-tool{padding:7px 8px;border-radius:7px;font-size:10px;font-weight:800;letter-spacing:.02em;white-space:nowrap}
    .analysis-tool[aria-pressed="true"]{border-color:#f0b90b;background:#2b2717;color:#f6d45b;box-shadow:inset 0 0 0 1px #f0b90b33}
    .analysis-tool[aria-pressed="false"]{color:#8f99a7;background:#171c22}
    .analysis-tool.unavailable{opacity:.55;cursor:help;border-style:dashed}
    .analysis-result{display:grid;gap:7px}.analysis-row{display:grid;grid-template-columns:76px 1fr;gap:8px;padding:7px 0;border-top:1px solid #2b3139}.analysis-row:first-child{border-top:0}
    .analysis-row b{font-size:10px;color:#f0b90b}.analysis-row span{color:#c7ced8;line-height:1.35}.analysis-row .pos{color:#0ecb81}.analysis-row .neg{color:#f6465d}.analysis-row .neutral{color:#c7ced8}
    .analysis-note{margin-top:8px;padding:8px;border:1px dashed #3a424c;border-radius:7px;color:#848e9c;font-size:10px;line-height:1.4}
    @media(max-width:760px){.analysis-tools{order:8;width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.analysis-tool{flex:0 0 auto}.analysis-row{grid-template-columns:64px 1fr}}
  `;
  document.head.appendChild(css);

  const toolbar=document.createElement('div');
  toolbar.id='analysisTools';
  toolbar.className='analysis-tools';
  defs.forEach(([key,label])=>{
    const b=document.createElement('button');
    b.type='button'; b.className='analysis-tool'; b.dataset.tool=key; b.textContent=label;
    b.addEventListener('click',()=>{state[key]=!state[key];save();sync();refresh(true);requestAnimationFrame(()=>{try{draw()}catch{}})});
    toolbar.appendChild(b);
  });
  const onchain=document.createElement('button');
  onchain.type='button'; onchain.className='analysis-tool unavailable'; onchain.textContent='ON-CHAIN'; onchain.title='On-chain — отдельный слой данных. Реальный on-chain feed пока не подключён; фиктивные данные не используются.';
  onchain.addEventListener('click',()=>{const n=document.getElementById('onchainNote');if(n){n.hidden=false;n.scrollIntoView({block:'nearest',behavior:'smooth'})}});
  toolbar.appendChild(onchain);
  apply.insertAdjacentElement('afterend',toolbar);

  const panel=document.createElement('section');
  panel.className='card panel';
  panel.id='technicalAnalysisPanel';
  panel.innerHTML='<h3 id="technicalAnalysisTitle">Технический анализ</h3><div class="analysis-result" id="technicalAnalysisBody"></div><div class="analysis-note" id="onchainNote" hidden>ON-CHAIN: для него нужен отдельный реальный источник блокчейн-метрик. Он не является обычным индикатором свечного таймфрейма, поэтому CRYPTO LAB не подставляет синтетические значения.</div>';
  side.insertBefore(panel,side.firstChild);

  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
  function sync(){toolbar.querySelectorAll('[data-tool]').forEach(b=>{const on=!!state[b.dataset.tool];b.setAttribute('aria-pressed',String(on));b.textContent=(on?'✓ ':'○ ')+defs.find(d=>d[0]===b.dataset.tool)[1]});const rsiWrap=document.querySelector('.canvas-wrap.rsi');if(rsiWrap)rsiWrap.style.display=state.rsi?'':'none'}
  function n(v){return Number.isFinite(Number(v))?Number(v):null}
  function f(v){try{return typeof fmt==='function'?fmt(v):Number(v).toFixed(4)}catch{return String(v)}}
  function emaSeries(values,p){const k=2/(p+1),out=[];let cur=values[0]||0;for(let i=0;i<values.length;i++){cur=i===0?values[i]:values[i]*k+cur*(1-k);out.push(cur)}return out}
  function sma(values,p){if(values.length<p)return null;const a=values.slice(-p);return a.reduce((s,v)=>s+v,0)/a.length}
  function sd(values,p){if(values.length<p)return null;const a=values.slice(-p),m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)}
  function atr14(rows){if(rows.length<15)return null;const tr=[];for(let i=1;i<rows.length;i++){const c=rows[i],p=rows[i-1];tr.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)))}return tr.slice(-14).reduce((s,v)=>s+v,0)/14}
  function macdNow(closes){if(closes.length<35)return null;const e12=emaSeries(closes,12),e26=emaSeries(closes,26),m=closes.map((_,i)=>e12[i]-e26[i]),sig=emaSeries(m,9);return {macd:m.at(-1),signal:sig.at(-1),hist:m.at(-1)-sig.at(-1)}}
  function vwapSeries(rows,period=100){const out=new Array(rows.length).fill(null);for(let i=0;i<rows.length;i++){let pv=0,v=0;for(let j=Math.max(0,i-period+1);j<=i;j++){const c=rows[j],vol=Number(c.volume)||0;pv+=((c.high+c.low+c.close)/3)*vol;v+=vol}out[i]=v?pv/v:null}return out}
  function bbSeries(rows,p=20){const closes=rows.map(c=>c.close),out={mid:new Array(rows.length).fill(null),upper:new Array(rows.length).fill(null),lower:new Array(rows.length).fill(null)};for(let i=p-1;i<rows.length;i++){const a=closes.slice(i-p+1,i+1),m=a.reduce((s,v)=>s+v,0)/p,d=Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/p);out.mid[i]=m;out.upper[i]=m+2*d;out.lower[i]=m-2*d}return out}
  function fibData(rows){if(!rows.length)return null;const hi=Math.max(...rows.map(c=>c.high)),lo=Math.min(...rows.map(c=>c.low)),hiI=rows.findIndex(c=>c.high===hi),loI=rows.findIndex(c=>c.low===lo),up=loI<hiI,range=hi-lo||1,levels={};[.236,.382,.5,.618,.786].forEach(r=>levels[r]=up?hi-range*r:lo+range*r);return {hi,lo,up,levels}}
  function trendData(rows){if(rows.length<55)return null;const closes=rows.map(c=>c.close),e20=emaSeries(closes,20).at(-1),e50=emaSeries(closes,50).at(-1),e200=closes.length>=200?emaSeries(closes,200).at(-1):null,last=closes.at(-1),ret20=(last/closes.at(-21)-1)*100;let bias='neutral';if(last>e20&&e20>e50&&(e200==null||e50>e200))bias='bull';else if(last<e20&&e20<e50&&(e200==null||e50<e200))bias='bear';return {bias,ret20,e20,e50,e200,last}}
  function row(label,text,cls='neutral'){return `<div class="analysis-row"><b>${label}</b><span class="${cls}">${text}</span></div>`}
  function refresh(force=false){
    if(typeof candles==='undefined'||!Array.isArray(candles)||candles.length<20)return;
    const sig=`${tf}|${candles.at(-1)?.time}|${JSON.stringify(state)}|${lang}`;if(!force&&sig===lastSignature)return;lastSignature=sig;
    const rows=candles.slice(-Math.min(180,candles.length)),closes=rows.map(c=>c.close),last=rows.at(-1),parts=[];
    const locale=lang==='uk'?'uk':lang==='en'?'en':'ru';
    const words={ru:{title:'Технический анализ',bull:'бычий',bear:'медвежий',neutral:'смешанный',above:'выше',below:'ниже',near:'ближайший',vol:'объём',avg:'среднего'},uk:{title:'Технічний аналіз',bull:'бичачий',bear:'ведмежий',neutral:'змішаний',above:'вище',below:'нижче',near:'найближчий',vol:'обсяг',avg:'середнього'},en:{title:'Technical analysis',bull:'bullish',bear:'bearish',neutral:'mixed',above:'above',below:'below',near:'nearest',vol:'volume',avg:'average'}}[locale];
    document.getElementById('technicalAnalysisTitle').textContent=`${words.title} · ${String(tf).toUpperCase()}`;
    if(state.ema){const e20=emaSeries(closes,20).at(-1),e50=emaSeries(closes,50).at(-1),e200=closes.length>=200?emaSeries(closes,200).at(-1):null;let bias='neutral';if(last.close>e20&&e20>e50&&(e200==null||e50>e200))bias='bull';else if(last.close<e20&&e20<e50&&(e200==null||e50<e200))bias='bear';parts.push(row('EMA',`${words[bias]} · 20 ${f(e20)} · 50 ${f(e50)}${e200?` · 200 ${f(e200)}`:''}`,bias==='bull'?'pos':bias==='bear'?'neg':'neutral'))}
    if(state.fib){const z=fibData(rows);if(z){const nearest=Object.entries(z.levels).sort((a,b)=>Math.abs(a[1]-last.close)-Math.abs(b[1]-last.close))[0];parts.push(row('FIB',`${z.up?'↑':'↓'} ${words.near} ${(Number(nearest[0])*100).toFixed(1)}% = ${f(nearest[1])} · 61.8% ${f(z.levels[.618])}`))}}
    if(state.rsi){const rv=Array.isArray(rsi14)?rsi14.at(-1):null;const cls=rv>=70?'neg':rv<=30?'pos':'neutral';parts.push(row('RSI',Number.isFinite(rv)?`${rv.toFixed(1)} · ${rv>=70?'overbought':rv<=30?'oversold':'neutral'}`:'—',cls))}
    if(state.macd){const m=macdNow(closes);if(m)parts.push(row('MACD',`${m.hist>=0?'+':''}${m.hist.toFixed(4)} histogram · MACD ${m.macd.toFixed(4)} / signal ${m.signal.toFixed(4)}`,m.hist>0?'pos':m.hist<0?'neg':'neutral'))}
    if(state.bb){const mid=sma(closes,20),d=sd(closes,20);if(mid&&d!=null){const up=mid+2*d,lo=mid-2*d,bw=(up-lo)/mid*100;parts.push(row('BB',`${last.close>up?'выше верхней':last.close<lo?'ниже нижней':last.close>=mid?'выше средней':'ниже средней'} · band ${f(lo)}–${f(up)} · width ${bw.toFixed(2)}%`,last.close>up?'pos':last.close<lo?'neg':'neutral'))}}
    if(state.vwap){const v=vwapSeries(rows,100).at(-1);if(v){const d=(last.close/v-1)*100;parts.push(row('VWAP',`${f(v)} · цена ${d>=0?words.above:words.below} на ${Math.abs(d).toFixed(2)}%`,d>=0?'pos':'neg'))}}
    if(state.atr){const a=atr14(rows);if(a){parts.push(row('ATR',`${f(a)} · ${(a/last.close*100).toFixed(2)}% от цены`))}}
    if(state.levels){const r=rows.slice(-80),sup=Math.min(...r.map(c=>c.low)),res=Math.max(...r.map(c=>c.high));parts.push(row('S/R',`S ${f(sup)} (${((last.close/sup-1)*100).toFixed(2)}%) · R ${f(res)} (${((res/last.close-1)*100).toFixed(2)}%)`))}
    if(state.volume){const av=rows.slice(-21,-1).reduce((s,c)=>s+c.volume,0)/Math.max(1,rows.slice(-21,-1).length),ratio=av?last.volume/av:0;parts.push(row('VOL',`${ratio.toFixed(2)}× ${words.avg} 20 свечей`,ratio>=1.4?'pos':ratio<.65?'neg':'neutral'))}
    if(state.trend){const t=trendData(rows);if(t)parts.push(row('TREND',`${words[t.bias]} · изменение 20 свечей ${t.ret20>=0?'+':''}${t.ret20.toFixed(2)}%`,t.bias==='bull'?'pos':t.bias==='bear'?'neg':'neutral'))}
    document.getElementById('technicalAnalysisBody').innerHTML=parts.join('')||row('—','Выберите инструменты анализа');
  }

  function drawOverlays(env){
    if(!env||typeof candles==='undefined'||!candles.length)return;
    const {ctx,w,pad,cw,current,visible,offset,y,x}=env;
    function h(v,color,label,dash=[4,4]){if(!Number.isFinite(v))return;const yy=y(v);ctx.save();ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle=color;ctx.font='9px system-ui';ctx.fillText(label,pad.l+5,yy-3);ctx.restore()}
    function line(values,color,width=1){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();let started=false;visible.forEach((c,i)=>{const v=values[offset+i];if(!Number.isFinite(v))return;const xx=x(i),yy=y(v);if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke();ctx.restore()}
    if(state.fib){const z=fibData(current.rows);if(z){Object.entries(z.levels).forEach(([r,v])=>h(v,'#d59cff',`F ${(Number(r)*100).toFixed(1)}%`,[3,5]))}}
    if(state.bb){const b=bbSeries(candles,20);line(b.upper,'#6f87ff',1);line(b.mid,'#8d9cff',.8);line(b.lower,'#6f87ff',1)}
    if(state.vwap){line(vwapSeries(candles,100),'#ff9f43',1.25)}
  }

  window.CryptoChartTools={enabled:key=>state[key]!==false,drawOverlays,refresh,state};
  sync();
  setInterval(()=>refresh(false),1200);
  setTimeout(()=>{refresh(true);requestAnimationFrame(()=>{try{draw()}catch{}})},300);
})();