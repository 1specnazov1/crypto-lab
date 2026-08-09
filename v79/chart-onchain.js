'use strict';
(() => {
  const button=[...document.querySelectorAll('.analysis-tool')].find(b=>String(b.textContent||'').includes('ON-CHAIN'));
  const technical=document.getElementById('technicalAnalysisPanel');
  if(!button||!technical)return;

  const URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-onchain';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const STORE='cryptoChartOnchainEnabledV1';
  let enabled=false,data=null,lastAsset='',loading=false;
  try{enabled=localStorage.getItem(STORE)==='1'}catch{}

  const panel=document.createElement('section');
  panel.className='card panel';
  panel.id='onchainPanel';
  panel.innerHTML='<h3 id="onchainTitle">ON-CHAIN</h3><div class="analysis-result" id="onchainBody"><div class="muted">Включите ON-CHAIN для загрузки реальных сетевых метрик.</div></div><div class="analysis-note" id="onchainSource">Источник: Coin Metrics Community API; для BTC дополнительно mempool.space.</div>';
  technical.insertAdjacentElement('afterend',panel);

  const oldNote=document.getElementById('onchainNote');if(oldNote)oldNote.hidden=true;
  button.classList.remove('unavailable');
  button.title='Реальные on-chain метрики: Coin Metrics Community API; для BTC live-сеть дополнительно mempool.space.';

  function token(){
    try{
      const raw=localStorage.getItem('sb-txhzxbizjpinowepfjkm-auth-token');
      if(!raw)return '';
      const v=JSON.parse(raw);
      return String(v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||'');
    }catch{return ''}
  }
  function setButton(){button.setAttribute('aria-pressed',String(enabled));button.textContent=(enabled?'✓ ':'○ ')+'ON-CHAIN';panel.style.display=enabled?'':'none'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function compact(v){const x=Number(v);if(!Number.isFinite(x))return '—';return new Intl.NumberFormat(lang==='uk'?'uk-UA':lang==='en'?'en-US':'ru-RU',{notation:Math.abs(x)>=10000?'compact':'standard',maximumFractionDigits:2}).format(x)}
  function usd(v){const x=Number(v);if(!Number.isFinite(x))return '—';return '$'+new Intl.NumberFormat('en-US',{notation:Math.abs(x)>=10000?'compact':'standard',maximumFractionDigits:2}).format(x)}
  function change(v){const x=Number(v);if(!Number.isFinite(x))return '';return ` <small class="${x>0?'pos':x<0?'neg':'neutral'}">${x>0?'+':''}${x.toFixed(1)}% / 7d</small>`}
  function metric(label,value,delta,formatter=compact){return `<div class="analysis-row"><b>${esc(label)}</b><span>${esc(formatter(value))}${change(delta)}</span></div>`}
  function words(){return lang==='uk'?{title:'ON-CHAIN · реальні дані',auth:'Увійдіть в акаунт CRYPTO LAB для on-chain даних.',loading:'Завантажую on-chain метрики…',none:'Для цього активу Community API не повернув on-chain дані.',err:'On-chain джерело тимчасово недоступне.',active:'Активні адреси',tx:'Транзакції',transfer:'Обсяг переказів',fees:'Комісії',supply:'Пропозиція',hash:'HashRate',mempool:'Mempool TX',fast:'Fast fee',hour:'1h fee',height:'Висота блока',diff:'Складність',note:'On-chain — мережеві дані 1D, вони не є внутрішньоденним індикатором свічкового TF.'}:lang==='en'?{title:'ON-CHAIN · real data',auth:'Sign in to CRYPTO LAB to load on-chain data.',loading:'Loading on-chain metrics…',none:'Community API returned no on-chain data for this asset.',err:'On-chain source is temporarily unavailable.',active:'Active addresses',tx:'Transactions',transfer:'Transfer volume',fees:'Fees',supply:'Supply',hash:'HashRate',mempool:'Mempool TX',fast:'Fast fee',hour:'1h fee',height:'Block height',diff:'Difficulty',note:'On-chain uses daily network data; it is not an intraday candle-timeframe indicator.'}:{title:'ON-CHAIN · реальные данные',auth:'Войдите в аккаунт CRYPTO LAB для загрузки on-chain данных.',loading:'Загружаю on-chain метрики…',none:'Для этого актива Community API не вернул on-chain данные.',err:'On-chain источник временно недоступен.',active:'Активные адреса',tx:'Транзакции',transfer:'Объём переводов',fees:'Комиссии',supply:'Предложение',hash:'HashRate',mempool:'Mempool TX',fast:'Fast fee',hour:'1h fee',height:'Высота блока',diff:'Сложность',note:'On-chain использует сетевые данные 1D и не является внутридневным индикатором свечного TF.'}}
  function render(){
    if(!enabled)return;
    const w=words(),body=document.getElementById('onchainBody');document.getElementById('onchainTitle').textContent=`${w.title} · ${String(symbol||'').toUpperCase()}`;
    if(loading){body.innerHTML=`<div class="muted">${w.loading}</div>`;return}
    if(!data){body.innerHTML=`<div class="muted">${w.auth}</div>`;return}
    if(data.error){body.innerHTML=`<div class="analysis-row"><b>STATUS</b><span class="neg">${esc(data.error)}</span></div>`;return}
    if(!data.supported){body.innerHTML=`<div class="muted">${w.none}</div>`;return}
    const m=data.metrics||{},d=data.changes_7d||{},rows=[];
    rows.push(metric(w.active,m.AdrActCnt,d.AdrActCnt));
    rows.push(metric(w.tx,m.TxCnt,d.TxCnt));
    rows.push(metric(w.transfer,m.TxTfrValAdjUSD,d.TxTfrValAdjUSD,usd));
    rows.push(metric(w.fees,m.FeeTotUSD,d.FeeTotUSD,usd));
    rows.push(metric(w.supply,m.SplyCur,d.SplyCur));
    if(Number.isFinite(Number(m.HashRate)))rows.push(metric(w.hash,m.HashRate,d.HashRate));
    const b=data.btc_live||{};
    if(String(data.asset)==='btc'){
      rows.push(metric(w.mempool,b.mempool_txs,null));
      rows.push(`<div class="analysis-row"><b>${w.fast}</b><span>${Number.isFinite(Number(b.fastest_fee_sat_vb))?Number(b.fastest_fee_sat_vb).toFixed(1)+' sat/vB':'—'}</span></div>`);
      rows.push(`<div class="analysis-row"><b>${w.hour}</b><span>${Number.isFinite(Number(b.hour_fee_sat_vb))?Number(b.hour_fee_sat_vb).toFixed(1)+' sat/vB':'—'}</span></div>`);
      rows.push(metric(w.height,b.block_height,null));
      rows.push(`<div class="analysis-row"><b>${w.diff}</b><span>${Number.isFinite(Number(b.difficulty_change_pct))?Number(b.difficulty_change_pct).toFixed(2)+'%':'—'}</span></div>`);
    }
    body.innerHTML=rows.join('')+`<div class="analysis-note">${w.note}</div>`;
    const src=document.getElementById('onchainSource');src.textContent=`${data.data_time?'Data '+new Date(data.data_time).toLocaleDateString():''} · Coin Metrics Community API${String(data.asset)==='btc'?' + mempool.space':''} · ${data.cached?'cache':'live fetch'}`;
  }
  async function load(force=false){
    if(!enabled||loading)return;
    const asset=String(symbol||'').toLowerCase();if(!asset)return;
    if(!force&&data&&lastAsset===asset)return render();
    const t=token();if(!t){data=null;render();return}
    loading=true;render();
    try{
      const r=await fetch(`${URL}?asset=${encodeURIComponent(asset)}`,{headers:{Authorization:`Bearer ${t}`,apikey:APIKEY,Accept:'application/json'},cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j?.error||`HTTP ${r.status}`);
      data=j;lastAsset=asset;
    }catch(e){data={error:e?.message||words().err};lastAsset=asset}
    finally{loading=false;render()}
  }
  button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(STORE,enabled?'1':'0')}catch{}setButton();if(enabled)load(true)});
  window.addEventListener('message',e=>{if(e.data?.type==='crypto-lab-language'){setTimeout(render,0)}});
  setButton();if(enabled)setTimeout(()=>load(true),100);
  setInterval(()=>{if(enabled)load(true)},120000);
})();