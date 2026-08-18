'use strict';
(() => {
  const tools=window.CryptoChartTools, toolbar=document.getElementById('analysisTools'), technical=document.getElementById('technicalAnalysisPanel');
  if(!tools||!toolbar||!technical||document.getElementById('cryptoSmartMoneyPanel'))return;

  const PROJECT='https://txhzxbizjpinowepfjkm.supabase.co';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const SMART_URL=PROJECT+'/functions/v1/crypto-lab-v79-smart-money';
  const KEY='cryptoChartProfessionalLayersV1';
  let state={smart:false,vp:false,avwap:false,structure:false},smart=null,loading=false,lastKey='';
  try{state={...state,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}

  const css=document.createElement('style');css.id='cryptoProfessionalLayerStyles';css.textContent=`
    .pro-layer-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pro-layer-metric{padding:7px 8px;border:1px solid #2b3139;border-radius:7px;background:#10151b}.pro-layer-metric span{display:block;color:#8994a2;font-size:9px}.pro-layer-metric b{display:block;margin-top:3px;font-size:11px;font-variant-numeric:tabular-nums}.smart-score{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border:1px solid #2b3139;border-radius:8px;margin-bottom:8px}.smart-score strong{font-size:19px}.smart-score.buy{border-color:#245943;background:#0d2119}.smart-score.sell{border-color:#713440;background:#251218}.smart-score.neutral{border-color:#62541f;background:#211d10}.pro-layer-note{margin-top:8px;color:#7f8a98;font-size:9px;line-height:1.45}.pro-layer-quality{font-size:9px;color:#9aa4b1}
  `;document.head.appendChild(css);

  const defs=[['smart','SMART'],['vp','VP'],['avwap','AVWAP'],['structure','STRUCT']];
  for(const [key,label] of defs){
    const b=document.createElement('button');b.type='button';b.className='analysis-tool';b.dataset.proTool=key;b.textContent=label;
    b.addEventListener('click',()=>{state[key]=!state[key];save();sync();if(key==='smart'&&state.smart)loadSmart(true);renderPanels();requestAnimationFrame(()=>{try{draw()}catch{}})});toolbar.appendChild(b);
  }

  const smartPanel=document.createElement('section');smartPanel.className='card panel';smartPanel.id='cryptoSmartMoneyPanel';smartPanel.innerHTML='<h3>SMART MONEY</h3><div id="cryptoSmartMoneyBody" class="muted">Включите SMART для загрузки derivatives/order-flow данных.</div>';
  const structurePanel=document.createElement('section');structurePanel.className='card panel';structurePanel.id='cryptoStructurePanel';structurePanel.innerHTML='<h3>VOLUME / STRUCTURE</h3><div id="cryptoStructureBody" class="analysis-result"></div>';
  const onchain=document.getElementById('onchainPanel');(onchain||technical).insertAdjacentElement('afterend',smartPanel);smartPanel.insertAdjacentElement('afterend',structurePanel);

  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
  function sync(){toolbar.querySelectorAll('[data-pro-tool]').forEach(b=>{const on=!!state[b.dataset.proTool];b.setAttribute('aria-pressed',String(on));b.textContent=(on?'✓ ':'○ ')+defs.find(d=>d[0]===b.dataset.proTool)?.[1]})}
  function token(){try{const raw=localStorage.getItem('sb-txhzxbizjpinowepfjkm-auth-token');if(!raw)return'';const v=JSON.parse(raw);return String(v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||'')}catch{return''}}
  function smartTf(){const map={'5m':'5M','15m':'15M','1h':'1H','4h':'4H','1d':'1D','1w':'1W','1M':'1MO'};return map[String(tf)]||'5M'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function compact(v,prefix=''){const x=Number(v);if(!Number.isFinite(x))return'—';const a=Math.abs(x);const n=a>=1e9?(x/1e9).toFixed(2)+'B':a>=1e6?(x/1e6).toFixed(2)+'M':a>=1e3?(x/1e3).toFixed(1)+'K':x.toFixed(2);return prefix+n}
  function pct(v,d=2){const x=Number(v);return Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(d)}%`:'—'}
  function ratioPressure(r){const x=Number(r);return Number.isFinite(x)&&x>0?(x-1)/(x+1):0}

  async function loadSmart(force=false){
    if(!state.smart||loading)return;const asset=String(symbol||'').toUpperCase(),stf=smartTf(),key=asset+':'+stf;
    if(!force&&smart&&lastKey===key)return;
    const t=token();if(!t){smart={error:'Войдите в аккаунт CRYPTO LAB для SMART MONEY.'};renderPanels();return}
    loading=true;renderPanels();
    try{
      const r=await fetch(SMART_URL,{method:'POST',headers:{Authorization:'Bearer '+t,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({symbol:asset,timeframe:stf}),cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error||`HTTP ${r.status}`);smart=j;lastKey=key;
    }catch(e){smart={error:e?.message||'SMART MONEY временно недоступен'}}finally{loading=false;renderPanels();requestAnimationFrame(()=>{try{draw()}catch{}})}
  }

  function smartMetric(label,value,cls=''){return `<div class="pro-layer-metric"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`}
  function renderSmart(){
    smartPanel.style.display=state.smart?'':'none';if(!state.smart)return;const body=document.getElementById('cryptoSmartMoneyBody');
    if(loading){body.innerHTML='<div class="muted">Загружаю SMART MONEY…</div>';return}
    if(!smart){body.innerHTML='<div class="muted">Нет данных.</div>';return}
    if(smart.error){body.innerHTML=`<div class="neg">${esc(smart.error)}</div>`;return}
    if(smart.supported===false){body.innerHTML='<div class="muted">Для этой монеты Binance USDⓈ-M не вернул derivatives-данные.</div>';return}
    const dir=String(smart.smart_direction||'NEUTRAL'),cls=dir==='BUY'?'buy':dir==='SELL'?'sell':'neutral',tone=dir==='BUY'?'pos':dir==='SELL'?'neg':'neutral';
    body.innerHTML=`<div class="smart-score ${cls}"><div><div class="pro-layer-quality">SMART PRESSURE · ${esc(smart.data_quality||'partial')}</div><b class="${tone}">${esc(dir)}</b></div><strong class="${tone}">${esc(smart.smart_score??'—')}/100</strong></div><div class="pro-layer-grid">
      ${smartMetric('Large BUY',compact(smart.whale_buy_usd,'$'),'pos')}${smartMetric('Large SELL',compact(smart.whale_sell_usd,'$'),'neg')}
      ${smartMetric('Whale Delta',compact(smart.whale_delta_usd,'$'),Number(smart.whale_delta_usd)>=0?'pos':'neg')}${smartMetric('CVD',compact(smart.cvd_usd,'$'),Number(smart.cvd_usd)>=0?'pos':'neg')}
      ${smartMetric('Taker B/S',Number.isFinite(Number(smart.taker_buy_sell_ratio))?Number(smart.taker_buy_sell_ratio).toFixed(3):'—')}${smartMetric('OI',compact(smart.open_interest_usd,'$'))}
      ${smartMetric('OI Δ',pct(smart.open_interest_change_pct),Number(smart.open_interest_change_pct)>=0?'pos':'neg')}${smartMetric('Funding',Number.isFinite(Number(smart.funding_rate))?(Number(smart.funding_rate)*100).toFixed(4)+'%':'—')}
      ${smartMetric('Book imbalance',pct(Number(smart.orderbook_imbalance)*100),Number(smart.orderbook_imbalance)>=0?'pos':'neg')}${smartMetric('Top traders',Number.isFinite(Number(smart.top_position_ratio))?Number(smart.top_position_ratio).toFixed(3):'—')}
    </div><div class="pro-layer-note">Large/Whale Flow — proxy аномально крупных taker-ордеров Binance Futures, а не идентификация кошельков. Порог сейчас: ${compact(smart.whale_threshold_usd,'$')}.</div>`;
  }

  function pivots(rows,w=3){const out=[];for(let i=w;i<rows.length-w;i++){let hi=true,lo=true;for(let j=i-w;j<=i+w;j++){if(i===j)continue;if(rows[j].high>rows[i].high)hi=false;if(rows[j].low<rows[i].low)lo=false}if(hi)out.push({i,type:'H',p:rows[i].high,time:rows[i].time});if(lo)out.push({i,type:'L',p:rows[i].low,time:rows[i].time})}return out.sort((a,b)=>a.i-b.i)}
  function profile(rows,bins=32){if(!rows?.length)return null;const lo=Math.min(...rows.map(c=>c.low)),hi=Math.max(...rows.map(c=>c.high)),step=(hi-lo)/bins||1,v=Array(bins).fill(0);for(const c of rows){const tp=(c.high+c.low+c.close)/3,idx=Math.max(0,Math.min(bins-1,Math.floor((tp-lo)/step)));v[idx]+=Number(c.volume)||0}const poc=v.indexOf(Math.max(...v)),total=v.reduce((a,b)=>a+b,0),target=total*.70;let l=poc,h=poc,sum=v[poc];while(sum<target&&(l>0||h<bins-1)){const lv=l>0?v[l-1]:-1,hv=h<bins-1?v[h+1]:-1;if(hv>=lv){h++;sum+=v[h]}else{l--;sum+=v[l]}}return{poc:lo+(poc+.5)*step,val:lo+l*step,vah:lo+(h+1)*step,lo,hi}}
  function avwapData(rows){if(!rows?.length)return null;const ps=pivots(rows,Math.max(2,Math.round(rows.length/50))),last=rows.at(-1),mid=rows[Math.max(0,rows.length-20)]?.close??last.close,bull=last.close>=mid,candidates=ps.filter(p=>p.type===(bull?'L':'H')&&p.i<rows.length-2),a=candidates.at(-1)||{i:Math.max(0,rows.length-40),type:bull?'L':'H',p:rows[Math.max(0,rows.length-40)].close,time:rows[Math.max(0,rows.length-40)].time};let pv=0,vol=0;const series=new Array(rows.length).fill(null);for(let i=a.i;i<rows.length;i++){const c=rows[i],vv=Number(c.volume)||0;pv+=((c.high+c.low+c.close)/3)*vv;vol+=vv;series[i]=vol?pv/vol:null}return{anchor:a,value:series.at(-1),series}}
  function structureData(rows){const ps=pivots(rows,3),highs=ps.filter(p=>p.type==='H'),lows=ps.filter(p=>p.type==='L'),h1=highs.at(-2),h2=highs.at(-1),l1=lows.at(-2),l2=lows.at(-1),last=rows.at(-1)?.close;if(!h1||!h2||!l1||!l2)return null;const hh=h2.p>h1.p,hl=l2.p>l1.p,bias=hh&&hl?'BULL':!hh&&!hl?'BEAR':'MIXED';let event='—',level=null;if(Number.isFinite(last)&&last>h2.p){event=bias==='BEAR'?'CHOCH ↑':'BOS ↑';level=h2.p}else if(Number.isFinite(last)&&last<l2.p){event=bias==='BULL'?'CHOCH ↓':'BOS ↓';level=l2.p}return{bias,event,level,lastHigh:h2.p,lastLow:l2.p,hh,hl}}
  function currentRows(){try{return window.CryptoChartViewport?.().rows||candles.slice(-120)}catch{return candles.slice(-120)}}
  function renderStructure(){
    structurePanel.style.display=(state.vp||state.avwap||state.structure)?'':'none';if(structurePanel.style.display==='none')return;const rows=currentRows(),parts=[];
    if(state.vp){const p=profile(rows);if(p)parts.push(`<div class="analysis-row"><b>VP</b><span>POC ${fmt(p.poc)} · VAH ${fmt(p.vah)} · VAL ${fmt(p.val)}</span></div>`)}
    if(state.avwap){const a=avwapData(rows);if(a)parts.push(`<div class="analysis-row"><b>AVWAP</b><span>${fmt(a.value)} · anchor ${a.anchor.type} ${new Date(a.anchor.time).toLocaleDateString()}</span></div>`)}
    if(state.structure){const s=structureData(rows);if(s){const c=s.bias==='BULL'?'pos':s.bias==='BEAR'?'neg':'neutral';parts.push(`<div class="analysis-row"><b>STRUCT</b><span class="${c}">${s.bias} · ${s.event} · H ${fmt(s.lastHigh)} · L ${fmt(s.lastLow)}</span></div>`)}}
    document.getElementById('cryptoStructureBody').innerHTML=parts.join('')||'<div class="muted">Нет достаточной структуры.</div>';
  }
  function renderPanels(){renderSmart();renderStructure()}

  function drawH(env,value,color,label,dash=[4,4]){if(!Number.isFinite(Number(value)))return;const yy=env.y(Number(value)),ctx=env.ctx;ctx.save();ctx.globalAlpha=.62;ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(env.pad.l,yy);ctx.lineTo(env.w-env.pad.r,yy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='bold 9px system-ui';ctx.fillText(label,env.pad.l+5,yy-4);ctx.restore()}
  function drawSmartZones(env){if(!state.smart||!smart||smart.error||smart.supported===false)return;const hist=Array.isArray(smart.flow_history)?smart.flow_history:[],rows=env.visible||env.current?.rows;if(!rows?.length||!hist.length)return;const ctx=env.ctx;ctx.save();for(const item of hist){const p=Number(item.pressure);if(!Number.isFinite(p)||Math.abs(p)<.10)continue;const ts=Number(item.timestamp);let idx=-1,best=Infinity;rows.forEach((c,i)=>{const d=Math.abs(Number(c.time)-ts);if(d<best){best=d;idx=i}});if(idx<0)continue;const xx=env.x(idx),width=Math.max(3,env.cw/Math.max(rows.length,1)*.85);ctx.fillStyle=p>0?`rgba(14,203,129,${Math.min(.10,.035+Math.abs(p)*.10)})`:`rgba(246,70,93,${Math.min(.10,.035+Math.abs(p)*.10)})`;ctx.fillRect(xx-width/2,env.pad.t,width,env.ch)}ctx.restore()}
  function drawVP(env){if(!state.vp)return;const p=profile(env.current?.rows||env.visible);if(!p)return;drawH(env,p.poc,'#f0b90b','POC');drawH(env,p.vah,'rgba(77,159,255,.9)','VAH',[3,5]);drawH(env,p.val,'rgba(77,159,255,.9)','VAL',[3,5])}
  function drawAVWAP(env){if(!state.avwap)return;const rows=env.current?.rows||env.visible,a=avwapData(rows);if(!a)return;const ctx=env.ctx;ctx.save();ctx.strokeStyle='#ff9f43';ctx.lineWidth=1.4;ctx.beginPath();let started=false;a.series.forEach((v,i)=>{if(!Number.isFinite(v))return;const xx=env.x(i),yy=env.y(v);if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke();ctx.restore()}
  function drawStructure(env){if(!state.structure)return;const s=structureData(env.current?.rows||env.visible);if(!s)return;if(s.level)drawH(env,s.level,s.event.includes('↑')?'#0ecb81':'#f6465d',s.event,[6,4])}

  const base=tools.drawOverlays.bind(tools);tools.drawOverlays=function professionalLayers(env){base(env);try{drawSmartZones(env)}catch{}try{drawVP(env)}catch{}try{drawAVWAP(env)}catch{}try{drawStructure(env)}catch{}try{renderStructure()}catch{}};
  sync();renderPanels();if(state.smart)setTimeout(()=>loadSmart(true),150);
  setInterval(()=>{if(state.smart)loadSmart(true)},60000);
  window.addEventListener('message',e=>{if(e.data?.type==='crypto-lab-language')setTimeout(renderPanels,0)});
})();
