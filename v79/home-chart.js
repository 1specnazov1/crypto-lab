'use strict';
(() => {
  const card=document.getElementById('homeChartCard');
  if(!card)return;

  const TF={
    '1m':{api:'1m',limit:120},'5m':{api:'5m',limit:120},'15m':{api:'15m',limit:120},'1h':{api:'1h',limit:120},
    '4h':{api:'4h',limit:120},'1D':{api:'1d',limit:120},'1W':{api:'1w',limit:104},'1M':{api:'1M',limit:60}
  };
  const I18N={
    ru:{live:'LIVE · Binance Spot',high:'Макс.',low:'Мин.',volume:'Объём 24ч',updated:'Обновлено',loading:'Загрузка свечей…',offline:'Данные Binance временно недоступны',open:'Откр.',close:'Закр.',vol:'Объём',source:'Источник'},
    uk:{live:'LIVE · Binance Spot',high:'Макс.',low:'Мін.',volume:'Обсяг 24г',updated:'Оновлено',loading:'Завантаження свічок…',offline:'Дані Binance тимчасово недоступні',open:'Відкр.',close:'Закр.',vol:'Обсяг',source:'Джерело'},
    en:{live:'LIVE · Binance Spot',high:'High',low:'Low',volume:'24h volume',updated:'Updated',loading:'Loading candles…',offline:'Binance data is temporarily unavailable',open:'Open',close:'Close',vol:'Volume',source:'Source'}
  };
  const locale=()=>typeof lang==='string'&&I18N[lang]?lang:'ru';
  const tr=()=>I18N[locale()];
  const savedTf=(()=>{try{return localStorage.getItem('cryptoLabHomeTf')}catch{return null}})();
  let timeframe=TF[savedTf]?savedTf:'15m',candles=[],ticker=null,hover=-1,loading=false,error='',resizeObserver=null;

  const style=document.createElement('style');
  style.id='homeBtcChartStyles';
  style.textContent=`
    #homeChartCard.home-terminal-chart{height:390px!important;padding:11px!important;cursor:default!important;overflow:hidden;display:flex;flex-direction:column;min-width:0}
    .home-chart-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:7px}.home-chart-symbol{display:flex;align-items:baseline;gap:8px;white-space:nowrap}.home-chart-symbol b{font-size:13px}.home-chart-symbol span{font-size:9px;color:#0ecb81;font-weight:800}
    .home-chart-tfs{display:flex;gap:3px;flex-wrap:wrap;margin-left:auto}.home-chart-tfs button{border:0;background:transparent;color:#848e9c;padding:5px 7px;border-radius:5px;min-height:27px;cursor:pointer;font-size:9px;font-weight:750}.home-chart-tfs button:hover{color:#fff;background:#1e2329}.home-chart-tfs button.on{color:#f0b90b;background:#f0b90b12}
    .home-chart-metrics{display:flex;align-items:center;gap:14px;min-height:34px;overflow-x:auto;white-space:nowrap;scrollbar-width:none;border-bottom:1px solid #2b3139;padding-bottom:7px}.home-chart-metrics::-webkit-scrollbar{display:none}.home-chart-price{font-size:20px;font-weight:900;color:#fff}.home-chart-change{font-size:11px;font-weight:800}.home-chart-metric{font-size:9px;color:#848e9c}.home-chart-metric b{display:block;color:#eaecef;font-size:10px;margin-top:1px}.home-chart-stage{position:relative;flex:1;min-height:0;margin-top:5px}.home-chart-stage canvas{display:block;width:100%;height:100%;touch-action:pan-y}.home-chart-tip{position:absolute;z-index:3;pointer-events:none;display:none;min-width:174px;padding:8px 9px;border:1px solid #3a424d;border-radius:7px;background:#11161dcc;backdrop-filter:blur(5px);font-size:9px;line-height:1.55;color:#c7cdd5;box-shadow:0 8px 24px #0008}.home-chart-tip b{color:#fff}.home-chart-tip .up{color:#0ecb81}.home-chart-tip .down{color:#f6465d}.home-chart-state{position:absolute;inset:0;display:grid;place-items:center;color:#848e9c;font-size:10px;pointer-events:none}.home-chart-state.bad{color:#f6465d}
    @media(max-width:850px){#homeChartCard.home-terminal-chart{height:380px!important}}
    @media(max-width:680px){#homeChartCard.home-terminal-chart{height:370px!important;padding:9px!important}.home-chart-top{align-items:flex-start}.home-chart-tfs{margin-left:0;width:100%;display:grid;grid-template-columns:repeat(8,1fr);gap:2px}.home-chart-tfs button{padding:5px 2px}.home-chart-metrics{gap:12px}.home-chart-price{font-size:18px}.home-chart-stage{min-height:270px}}
    @media(max-width:390px){.home-chart-tfs{grid-template-columns:repeat(4,1fr)}#homeChartCard.home-terminal-chart{height:405px!important}}
  `;
  document.head.appendChild(style);

  card.classList.add('home-terminal-chart');
  card.setAttribute('data-home-chart-interactive','true');
  card.innerHTML=`
    <div class="home-chart-top" data-home-chart-interactive>
      <div class="home-chart-symbol"><b>BTC / USDT</b><span id="homeChartLive">LIVE</span></div>
      <div class="home-chart-tfs" id="homeChartTfs">${Object.keys(TF).map(tf=>`<button type="button" data-home-tf="${tf}">${tf}</button>`).join('')}</div>
    </div>
    <div class="home-chart-metrics" data-home-chart-interactive>
      <div><span class="home-chart-price" id="homeChartPrice">—</span><span class="home-chart-change" id="homeChartChange"> —</span></div>
      <div class="home-chart-metric" id="homeChartHighLabel">Макс.<b id="homeChartHigh">—</b></div>
      <div class="home-chart-metric" id="homeChartLowLabel">Мин.<b id="homeChartLow">—</b></div>
      <div class="home-chart-metric" id="homeChartVolumeLabel">Объём 24ч<b id="homeChartVolume">—</b></div>
      <div class="home-chart-metric" id="homeChartUpdatedLabel">Обновлено<b id="homeChartUpdated">—</b></div>
    </div>
    <div class="home-chart-stage" id="homeChartStage" data-home-chart-interactive>
      <canvas id="homeBtcCanvas" aria-label="BTC USDT live candlestick chart"></canvas>
      <div class="home-chart-tip" id="homeChartTip"></div>
      <div class="home-chart-state" id="homeChartState"></div>
    </div>`;

  const $h=id=>document.getElementById(id),canvas=$h('homeBtcCanvas'),ctx=canvas.getContext('2d'),tip=$h('homeChartTip'),stage=$h('homeChartStage');
  const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
  const price=v=>Number.isFinite(Number(v))?'$'+nf.format(Number(v)):'—';
  const compact=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(1)+'K';return'$'+n.toFixed(0)};
  const volume=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';if(n>=1e6)return(n/1e6).toFixed(2)+'M BTC';if(n>=1e3)return(n/1e3).toFixed(1)+'K BTC';return n.toFixed(3)+' BTC'};
  const dt=(ms,full=false)=>{try{return new Intl.DateTimeFormat(locale()==='uk'?'uk-UA':locale()==='en'?'en-GB':'ru-RU',full?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))}catch{return'—'}};
  const axisTime=ms=>{const d=new Date(ms);if(timeframe==='1m'||timeframe==='5m'||timeframe==='15m'||timeframe==='1h'||timeframe==='4h')return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');if(timeframe==='1D')return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');if(timeframe==='1W')return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');return String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getFullYear()).slice(-2)};

  async function getJson(path){
    const hosts=['https://api.binance.com','https://data-api.binance.vision'];
    let last;
    for(const host of hosts){try{const r=await fetch(host+path,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}catch(e){last=e}}
    throw last||Error('Binance unavailable');
  }

  function parseKlines(rows){return Array.isArray(rows)?rows.map(r=>({time:Number(r[0]),open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4]),volume:Number(r[5]),closeTime:Number(r[6])})).filter(c=>[c.open,c.high,c.low,c.close].every(Number.isFinite)):[]}

  function updateLabels(){
    const t=tr();$h('homeChartLive').textContent=t.live;$h('homeChartHighLabel').childNodes[0].nodeValue=t.high;$h('homeChartLowLabel').childNodes[0].nodeValue=t.low;$h('homeChartVolumeLabel').childNodes[0].nodeValue=t.volume;$h('homeChartUpdatedLabel').childNodes[0].nodeValue=t.updated;
    document.querySelectorAll('[data-home-tf]').forEach(b=>b.classList.toggle('on',b.dataset.homeTf===timeframe));
  }

  function visibleCandles(){
    const width=Math.max(280,stage.clientWidth||600),max=Math.max(36,Math.floor((width-80)/8));
    return candles.slice(-Math.min(candles.length,max));
  }

  function updateMetrics(){
    const list=visibleCandles();if(!list.length)return;
    const first=list[0],last=list[list.length-1],current=Number.isFinite(ticker?.lastPrice)?ticker.lastPrice:last.close,hi=Math.max(...list.map(c=>c.high),current),lo=Math.min(...list.map(c=>c.low),current),chg=(current-first.open)/first.open*100;
    $h('homeChartPrice').textContent=price(current);$h('homeChartChange').textContent=` ${chg>=0?'+':''}${chg.toFixed(2)}%`;$h('homeChartChange').style.color=chg>=0?'#0ecb81':'#f6465d';
    $h('homeChartHigh').textContent=price(hi);$h('homeChartLow').textContent=price(lo);$h('homeChartVolume').textContent=compact(ticker?.quoteVolume);$h('homeChartUpdated').textContent=dt(last.closeTime||Date.now());
  }

  function fitCanvas(){
    const rect=stage.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(280,Math.floor(rect.width)),h=Math.max(235,Math.floor(rect.height));
    if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
    return{w,h};
  }

  function draw(){
    const {w,h}=fitCanvas(),list=visibleCandles();ctx.clearRect(0,0,w,h);if(!list.length)return;
    const left=6,right=69,top=14,bottom=26,volH=Math.max(45,Math.min(62,h*.2)),plotW=w-left-right,priceH=h-top-bottom-volH-7,priceBottom=top+priceH,volTop=priceBottom+8,volBottom=h-bottom;
    const current=Number.isFinite(ticker?.lastPrice)?ticker.lastPrice:list[list.length-1].close;
    let lo=Math.min(...list.map(c=>c.low),current),hi=Math.max(...list.map(c=>c.high),current);const pad=(hi-lo||hi*.002||1)*.07;lo-=pad;hi+=pad;
    const y=p=>top+(hi-p)/(hi-lo)*priceH,x=i=>left+(i+.5)/list.length*plotW,step=plotW/list.length,body=Math.max(2,Math.min(8,step*.62)),maxVol=Math.max(...list.map(c=>c.volume),1);

    ctx.lineWidth=1;ctx.font='9px system-ui';ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){const yy=top+i*priceH/4,p=hi-i*(hi-lo)/4;ctx.strokeStyle='#27303a';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right+4,yy);ctx.stroke();ctx.fillStyle='#7d8794';ctx.textAlign='left';ctx.fillText(nf.format(p),w-right+9,yy)}
    for(let i=0;i<5;i++){const idx=Math.min(list.length-1,Math.round(i*(list.length-1)/4)),xx=x(idx);ctx.strokeStyle='#202831';ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,volBottom);ctx.stroke();ctx.fillStyle='#7d8794';ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(axisTime(list[idx].time),i===0?left:i===4?w-right:xx,h-9)}
    ctx.strokeStyle='#2b3139';ctx.beginPath();ctx.moveTo(left,priceBottom+3);ctx.lineTo(w-right+4,priceBottom+3);ctx.stroke();

    list.forEach((c,i)=>{const xx=x(i),up=c.close>=c.open,col=up?'#0ecb81':'#f6465d';ctx.strokeStyle=col;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(xx,y(c.high));ctx.lineTo(xx,y(c.low));ctx.stroke();const y1=y(Math.max(c.open,c.close)),y2=y(Math.min(c.open,c.close)),bh=Math.max(1.5,y2-y1);ctx.fillRect(xx-body/2,y1,body,bh);const vh=(c.volume/maxVol)*(volBottom-volTop);ctx.globalAlpha=.38;ctx.fillRect(xx-body/2,volBottom-vh,body,vh);ctx.globalAlpha=1});

    const last=list[list.length-1],ly=y(current),priceUp=current>=last.open;ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=priceUp?'#0ecb81':'#f6465d';ctx.beginPath();ctx.moveTo(left,ly);ctx.lineTo(w-right+5,ly);ctx.stroke();ctx.restore();ctx.fillStyle=priceUp?'#0ecb81':'#f6465d';ctx.fillRect(w-right+5,ly-9,right-8,18);ctx.fillStyle='#0b0e11';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText(nf.format(current),w-right/2+1,ly);

    if(hover>=0&&hover<list.length){const c=list[hover],xx=x(hover),yy=y(c.close);ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle='#9aa4b2aa';ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,volBottom);ctx.moveTo(left,yy);ctx.lineTo(w-right+4,yy);ctx.stroke();ctx.restore()}
  }

  function setHover(clientX,clientY){
    const rect=canvas.getBoundingClientRect(),list=visibleCandles();if(!list.length)return;const left=6,right=69,plotW=rect.width-left-right;const px=Math.max(0,Math.min(plotW-1,clientX-rect.left-left)),idx=Math.max(0,Math.min(list.length-1,Math.floor(px/plotW*list.length)));hover=idx;const c=list[idx],up=c.close>=c.open,change=(c.close-c.open)/c.open*100;
    tip.innerHTML=`<b>${dt(c.time,true)}</b><br>${tr().open}: <b>${nf.format(c.open)}</b> · H: <b>${nf.format(c.high)}</b><br>L: <b>${nf.format(c.low)}</b> · ${tr().close}: <b>${nf.format(c.close)}</b><br>${tr().vol}: <b>${volume(c.volume)}</b> · <span class="${up?'up':'down'}">${change>=0?'+':''}${change.toFixed(2)}%</span>`;
    tip.style.display='block';const stageRect=stage.getBoundingClientRect(),tipW=185,tipH=76,x=Math.min(stageRect.width-tipW-5,Math.max(5,clientX-stageRect.left+12)),y=Math.min(stageRect.height-tipH-5,Math.max(5,clientY-stageRect.top+12));tip.style.left=x+'px';tip.style.top=y+'px';draw();
  }

  canvas.addEventListener('pointermove',e=>setHover(e.clientX,e.clientY));canvas.addEventListener('pointerdown',e=>setHover(e.clientX,e.clientY));canvas.addEventListener('pointerleave',()=>{hover=-1;tip.style.display='none';draw()});canvas.addEventListener('click',e=>e.stopPropagation());
  document.getElementById('homeChartTfs').addEventListener('click',e=>{const b=e.target.closest('[data-home-tf]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.dataset.homeTf===timeframe)return;timeframe=b.dataset.homeTf;try{localStorage.setItem('cryptoLabHomeTf',timeframe)}catch{}updateLabels();load()});

  const originalCardClick=card.onclick;card.onclick=e=>{if(e.target.closest('[data-home-chart-interactive]'))return;if(typeof originalCardClick==='function')originalCardClick.call(card,e)};

  async function load(){
    if(loading)return;loading=true;error='';hover=-1;tip.style.display='none';$h('homeChartState').className='home-chart-state';$h('homeChartState').textContent=tr().loading;
    try{
      const cfg=TF[timeframe],[rows,tick]=await Promise.all([getJson(`/api/v3/klines?symbol=BTCUSDT&interval=${encodeURIComponent(cfg.api)}&limit=${cfg.limit}`),getJson('/api/v3/ticker/24hr?symbol=BTCUSDT')]);
      candles=parseKlines(rows);ticker={quoteVolume:Number(tick?.quoteVolume),lastPrice:Number(tick?.lastPrice)};if(!candles.length)throw Error('No candle data');$h('homeChartState').textContent='';updateMetrics();draw();
    }catch(e){error=String(e?.message||e);$h('homeChartState').className='home-chart-state bad';$h('homeChartState').textContent=tr().offline;draw()}finally{loading=false}
  }

  resizeObserver=new ResizeObserver(()=>{updateMetrics();draw()});resizeObserver.observe(stage);
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(()=>{updateLabels();updateMetrics();draw()},0));
  updateLabels();load();setInterval(load,30000);
})();
