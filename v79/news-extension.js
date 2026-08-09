'use strict';
(() => {
  const BUILD='7930free12';
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-news';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  if(!ROUTES.some(r=>r[0]==='news')){
    const analyticsIndex=Math.max(0,ROUTES.findIndex(r=>r[0]==='analytics'));
    const insertAt=analyticsIndex+1;
    ROUTES.splice(insertAt,0,['news','⚡']);
    const labels={ru:'Новости',uk:'Новини',en:'News'};
    for(const code of ['ru','uk','en']){
      const nav=T?.[code]?.nav;
      if(Array.isArray(nav)&&!nav.includes(labels[code]))nav.splice(insertAt,0,labels[code]);
    }
  }
  const previousFrameUrl=frameUrl,previousOpen=open;
  frameUrl=function newsFrameUrl(route,signal){if(route==='news')return './news.html?lang='+encodeURIComponent(lang);return previousFrameUrl(route,signal)};
  open=function newsOpen(route,signal){if(route!=='news')return previousOpen(route,signal);current='news';$('nav').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.route==='news'));$('side').classList.remove('open');['homeView','scannerView','frameView','placeholderView'].forEach(id=>$(id).classList.add('hide'));$('frameView').classList.remove('hide');$('frame').src=frameUrl('news')};

  if(!document.getElementById('newsTickerStyles')){const s=document.createElement('style');s.id='newsTickerStyles';s.textContent=`
    .market-news-ticker{display:none;position:relative;z-index:4;height:31px;overflow:hidden;border-bottom:1px solid #f6465d55;background:linear-gradient(90deg,#241216,#171417 42%,#19170e);cursor:pointer;white-space:nowrap}
    .market-news-ticker.show{display:block}.market-news-ticker:before{content:'⚡ BREAKING';position:absolute;left:0;top:0;bottom:0;z-index:2;display:flex;align-items:center;padding:0 10px;background:#2b1217;color:#ff8a9b;font-size:10px;font-weight:950;letter-spacing:.06em;border-right:1px solid #f6465d55}
    .market-news-track{display:inline-flex;align-items:center;height:100%;padding-left:110px;color:#eaecef;font-size:11px;font-weight:750;animation:cryptoNewsTicker 28s linear infinite;will-change:transform}
    .market-news-track b{color:#ffe58f}.market-news-track .src{color:#9ba5b3;font-weight:600}.market-news-ticker:hover .market-news-track{animation-play-state:paused}
    @keyframes cryptoNewsTicker{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
    @media(max-width:680px){.market-news-ticker{height:29px}.market-news-ticker:before{padding:0 7px;font-size:9px}.market-news-track{padding-left:92px;font-size:10px;animation-duration:24s}}
  `;document.head.appendChild(s)}
  let ticker=document.getElementById('marketNewsTicker');if(!ticker){ticker=document.createElement('div');ticker.id='marketNewsTicker';ticker.className='market-news-ticker';ticker.innerHTML='<div class="market-news-track" id="marketNewsTrack"></div>';const top=document.querySelector('.main > .top')||document.querySelector('.top');top?.insertAdjacentElement('afterend',ticker);ticker.addEventListener('click',()=>open('news'))}
  function authToken(){try{const raw=localStorage.getItem('sb-txhzxbizjpinowepfjkm-auth-token');if(!raw)return'';const v=JSON.parse(raw);return String(v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||'')}catch{return''}}
  function fmt(v){try{return new Intl.DateTimeFormat(lang==='uk'?'uk-UA':lang==='en'?'en-GB':'ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return'—'}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function dir(d){if(lang==='uk')return d==='positive'?'BTC: ймовірно +':d==='negative'?'BTC: ймовірно −':d==='mixed'?'BTC: змішано':'BTC: нейтрально';if(lang==='en')return d==='positive'?'BTC: likely +':d==='negative'?'BTC: likely −':d==='mixed'?'BTC: mixed':'BTC: neutral';return d==='positive'?'BTC: вероятно +':d==='negative'?'BTC: вероятно −':d==='mixed'?'BTC: смешанно':'BTC: нейтрально'}
  async function refreshTicker(){const tk=authToken();if(!tk){ticker?.classList.remove('show');return}try{const r=await fetch(ENDPOINT+'?limit=30&min_impact=75',{headers:{Authorization:`Bearer ${tk}`,apikey:APIKEY},cache:'no-store'});const j=await r.json();if(!r.ok||!j?.ok)throw Error();const arr=(j.breaking||[]).slice(0,5);if(!arr.length){ticker?.classList.remove('show');window.CRYPTO_NEWS_TICKER_STATUS={ok:true,breaking:0,last_refresh:new Date().toISOString()};return}const text=arr.map(x=>`<b>${esc(fmt(x.published_at))} · ${esc(x.region)}</b> · ${esc(x.title)} · <span class="src">${esc(x?.metadata?.source_name||x.domain||'')} · Impact ${esc(x.impact_score)} · ${esc(dir(x.direction))}</span>`).join('&nbsp;&nbsp;&nbsp; ◆ &nbsp;&nbsp;&nbsp;');const track=document.getElementById('marketNewsTrack');if(track){track.innerHTML=text;track.style.animationDuration=Math.max(24,Math.min(75,text.replace(/<[^>]+>/g,'').length/8))+'s'}ticker?.classList.add('show');window.CRYPTO_NEWS_TICKER_STATUS={ok:true,breaking:arr.length,last_refresh:new Date().toISOString()}}catch{ticker?.classList.remove('show');window.CRYPTO_NEWS_TICKER_STATUS={ok:false,breaking:0,last_refresh:new Date().toISOString()}}}
  const baseTranslate=translate;translate=function newsTranslate(){baseTranslate();refreshTicker()};translate();
  const requested=new URLSearchParams(location.search).get('route');if(requested==='news')setTimeout(()=>open('news'),0);
  refreshTicker();setInterval(refreshTicker,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTicker()});
})();