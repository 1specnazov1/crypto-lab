'use strict';
(() => {
  const KEY='cryptoLabBreakingTickerDismissedV1';
  let languageSwitchUntil=0;
  let lastSignature='';
  const $=id=>document.getElementById(id);
  function lang(){try{return String(window.lang||$('lang')?.value||'ru')}catch{return $('lang')?.value||'ru'}}
  function label(){const l=lang();return l==='uk'?'Гарячі новини':l==='en'?'Breaking news':'Горячие новости'}
  function hash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function signature(){const track=$('marketNewsTrack');return track?.textContent?.trim()?hash(track.textContent.replace(/\s+/g,' ').trim()):''}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
  function write(sig){try{localStorage.setItem(KEY,JSON.stringify({signature:sig,hidden:true,at:Date.now()}))}catch{}}
  function clear(){try{localStorage.removeItem(KEY)}catch{}}
  function ticker(){return $('marketNewsTicker')}
  function checkbox(){return $('newsTickerToggle')}
  function syncControl(){const cb=checkbox();if(!cb)return;cb.checked=ticker()?.classList.contains('show')||false;const text=$('newsTickerToggleText');if(text)text.textContent=label()}
  function hideCurrent(){const sig=signature()||lastSignature;if(sig)write(sig);ticker()?.classList.remove('show');syncControl()}
  function showCurrent(){clear();if(signature())ticker()?.classList.add('show');syncControl()}
  function install(){
    const top=document.querySelector('.main > .top')||document.querySelector('.top');
    if(top&&!$('newsTickerToggleWrap')){
      const wrap=document.createElement('label');wrap.id='newsTickerToggleWrap';wrap.className='news-ticker-toggle';wrap.innerHTML='<input id="newsTickerToggle" type="checkbox" checked><span id="newsTickerToggleText"></span>';
      const language=$('lang');language?.insertAdjacentElement('beforebegin',wrap)||top.appendChild(wrap);
      $('newsTickerToggle')?.addEventListener('change',e=>{e.stopPropagation();e.target.checked?showCurrent():hideCurrent()});
    }
    const t=ticker();
    if(t&&!$('newsTickerClose')){
      const close=document.createElement('button');close.id='newsTickerClose';close.className='news-ticker-close';close.type='button';close.title=lang()==='uk'?'Сховати до нової гарячої новини':lang()==='en'?'Hide until a new breaking story':'Скрыть до новой горячей новости';close.setAttribute('aria-label',close.title);close.textContent='×';close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hideCurrent()});t.appendChild(close);
    }
    if(!$('newsTickerControlStyles')){
      const style=document.createElement('style');style.id='newsTickerControlStyles';style.textContent=`
        .news-ticker-toggle{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:5px 7px;border:1px solid #2b3139;border-radius:7px;background:#151a21;color:#9ba5b3;font-size:9px;font-weight:750;cursor:pointer;white-space:nowrap}
        .news-ticker-toggle input{margin:0;width:12px;height:12px;accent-color:#f0b90b}
        .news-ticker-close{position:absolute;right:5px;top:4px;z-index:5;width:22px;height:22px;padding:0;border:1px solid #f6465d55;border-radius:6px;background:#1b1114;color:#ff9aaa;font-size:16px;line-height:18px;cursor:pointer}
        .market-news-track{padding-right:38px!important}
        @media(max-width:850px){.news-ticker-toggle span{display:none}.news-ticker-toggle{padding:5px}.news-ticker-close{right:3px}}
      `;document.head.appendChild(style);
    }
    syncControl();
  }
  function evaluateMutation(){
    install();
    const sig=signature();if(!sig)return;
    const stored=read();
    if(Date.now()<languageSwitchUntil&&stored?.hidden){write(sig);lastSignature=sig;ticker()?.classList.remove('show');syncControl();return}
    if(stored?.hidden&&stored.signature===sig){ticker()?.classList.remove('show');syncControl();lastSignature=sig;return}
    if(stored?.hidden&&stored.signature!==sig){clear();ticker()?.classList.add('show');syncControl()}
    lastSignature=sig;
  }
  const observer=new MutationObserver(()=>queueMicrotask(evaluateMutation));observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  $('lang')?.addEventListener('change',()=>{languageSwitchUntil=Date.now()+2500;setTimeout(()=>{install();syncControl()},0)},true);
  install();setTimeout(evaluateMutation,100);setInterval(()=>{install();evaluateMutation()},1500);
  setInterval(()=>{if(document.hidden)return;try{if(typeof translate==='function')translate()}catch{}},60000);
})();
