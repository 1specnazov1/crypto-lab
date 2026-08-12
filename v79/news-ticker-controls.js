'use strict';
(() => {
  const KEY='cryptoLabBreakingTickerDismissedV1';
  const MAX_PASSES=3;
  let languageSwitchUntil=0,lastSignature='',trackObserver=null,startupObserver=null,passSignature='',passes=0;
  const $=id=>document.getElementById(id);
  function lang(){try{return String(window.lang||$('lang')?.value||'ru')}catch{return $('lang')?.value||'ru'}}
  function label(){const l=lang();return l==='uk'?'Гарячі новини':l==='en'?'Breaking news':'Горячие новости'}
  function hash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function signature(){const track=$('marketNewsTrack');const text=track?.textContent?.replace(/\s+/g,' ').trim()||'';return text?hash(text):''}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
  function write(sig,reason='operator'){try{localStorage.setItem(KEY,JSON.stringify({signature:sig,hidden:true,reason,at:Date.now()}))}catch{}}
  function clear(){try{localStorage.removeItem(KEY)}catch{}}
  function ticker(){return $('marketNewsTicker')}
  function checkbox(){return $('newsTickerToggle')}
  function resetPasses(sig=''){passSignature=sig;passes=0}
  function syncControl(){const cb=checkbox();if(cb)cb.checked=!!ticker()?.classList.contains('show');const text=$('newsTickerToggleText'),next=label();if(text&&text.textContent!==next)text.textContent=next}
  function hideCurrent(reason='operator'){const sig=signature()||lastSignature;if(sig)write(sig,reason);ticker()?.classList.remove('show');syncControl()}
  function showCurrent(){
    const sig=signature();if(!sig){syncControl();return}
    const stored=read();
    if(stored?.hidden&&stored.signature===sig&&stored.reason==='completed'){ticker()?.classList.remove('show');syncControl();return}
    clear();resetPasses(sig);ticker()?.classList.add('show');syncControl()
  }
  function applyState(){
    const sig=signature();if(!sig){syncControl();return}
    if(sig!==passSignature)resetPasses(sig);
    const stored=read();
    if(Date.now()<languageSwitchUntil&&stored?.hidden){write(sig,stored.reason||'completed');lastSignature=sig;ticker()?.classList.remove('show');syncControl();return}
    if(stored?.hidden&&stored.signature===sig){lastSignature=sig;ticker()?.classList.remove('show');syncControl();return}
    if(stored?.hidden&&stored.signature!==sig){clear();resetPasses(sig);ticker()?.classList.add('show')}
    lastSignature=sig;syncControl()
  }
  function completedPass(){
    const sig=signature();
    if(!sig||!ticker()?.classList.contains('show'))return;
    if(sig!==passSignature)resetPasses(sig);
    passes+=1;
    window.CRYPTO_NEWS_TICKER_PASSES={signature:sig,passes,max:MAX_PASSES};
    if(passes>=MAX_PASSES)hideCurrent('completed');
  }
  function bindTrack(){
    const track=$('marketNewsTrack');if(!track)return false;
    if(track.dataset.tickerControlBound==='1')return true;
    track.dataset.tickerControlBound='1';
    track.addEventListener('animationiteration',completedPass);
    trackObserver?.disconnect();
    trackObserver=new MutationObserver(()=>queueMicrotask(applyState));
    trackObserver.observe(track,{childList:true,subtree:true,characterData:true});
    queueMicrotask(applyState);return true
  }
  function install(){
    const top=document.querySelector('.main > .top')||document.querySelector('.top');
    if(top&&!$('newsTickerToggleWrap')){
      const wrap=document.createElement('label');wrap.id='newsTickerToggleWrap';wrap.className='news-ticker-toggle';wrap.innerHTML='<input id="newsTickerToggle" type="checkbox" checked><span id="newsTickerToggleText"></span>';
      const language=$('lang');language?.insertAdjacentElement('beforebegin',wrap)||top.appendChild(wrap);
      $('newsTickerToggle')?.addEventListener('change',e=>{e.stopPropagation();e.target.checked?showCurrent():hideCurrent('operator')})
    }
    let style=$('newsTickerControlStyles');if(!style){style=document.createElement('style');style.id='newsTickerControlStyles';document.head.appendChild(style)}
    style.textContent='.news-ticker-toggle{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:5px 7px;border:1px solid #2b3139;border-radius:7px;background:#151a21;color:#9ba5b3;font-size:9px;font-weight:750;cursor:pointer;white-space:nowrap}.news-ticker-toggle input{margin:0;width:12px;height:12px;accent-color:#f0b90b}@media(max-width:850px){.news-ticker-toggle span{display:none}.news-ticker-toggle{padding:5px}}';
    syncControl();return bindTrack()
  }
  $('lang')?.addEventListener('change',()=>{languageSwitchUntil=Date.now()+2500;setTimeout(()=>{install();applyState()},0)},true);
  if(!install()){startupObserver=new MutationObserver(()=>{if(install())startupObserver?.disconnect()});startupObserver.observe(document.body,{childList:true,subtree:true})}
  setTimeout(()=>{install();applyState()},100);
})();
