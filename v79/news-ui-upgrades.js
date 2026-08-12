'use strict';
(() => {
  // Contract marker: data-news-filter cards are interactive summary filters.
  const $=id=>document.getElementById(id);
  const summary=document.querySelector('.summary');
  const list=$('list');
  const impact=$('impact');
  const regions=$('regions');
  if(!summary||!list||!impact)return;

  let mode='all';
  const cards=[...summary.querySelectorAll('.stat')];
  const cardCritical=cards[1],cardHigh=cards[2],cardBreaking=cards[3];
  const filterCards={critical:cardCritical,high:cardHigh,breaking:cardBreaking};

  if(!$('newsUiUpgradeStyles')){
    const style=document.createElement('style');
    style.id='newsUiUpgradeStyles';
    style.textContent=`
      .news-title-cont{color:#8e99a7;font-size:12px;font-weight:520;line-height:1.45}
      #subtitle{display:none!important}
      .summary .stat.news-filter{cursor:pointer;transition:border-color .14s ease,background .14s ease,transform .14s ease;user-select:none}
      .summary .stat.news-filter:hover{border-color:#465362;background:#181f27;transform:translateY(-1px)}
      .summary .stat.news-filter.filter-on{border-color:#f0b90b88;background:#f0b90b0d;box-shadow:inset 0 0 0 1px #f0b90b20}
      .summary .stat.news-filter:focus-visible{outline:2px solid #f0b90b;outline-offset:2px}
      .item.news-filter-hidden{display:none!important}
      @media(max-width:760px){.news-title-cont{display:inline;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function combineHeading(){
    const title=$('title'),subtitle=$('subtitle');
    if(!title||!subtitle)return;
    const now=title.textContent.trim();
    if(!now.includes(' · '+subtitle.textContent.trim())&&!now.includes(' — '+subtitle.textContent.trim()))title.dataset.newsBaseTitle=now.split(' · Только')[0].split(' · Лише')[0].split(' · Only')[0];
    const base=title.dataset.newsBaseTitle||now;
    const sub=subtitle.textContent.trim();
    const next=`${base} · ${sub}`;
    if(title.textContent!==next){
      title.textContent='';
      title.append(document.createTextNode(base+' · '));
      const span=document.createElement('span');
      span.className='news-title-cont';
      span.textContent=sub;
      title.appendChild(span);
    }
  }

  function scoreOf(article){return Number.parseInt(article.querySelector('.score strong')?.textContent||'',10)}
  function publishedAt(article){
    const raw=article.querySelector('.meta span:last-child')?.textContent||'';
    const nums=raw.match(/\d{1,2}/g)||[];
    if(nums.length<4)return NaN;
    const [day,month,hour,minute]=nums.slice(0,4).map(Number),now=new Date();
    let date=new Date(now.getFullYear(),month-1,day,hour,minute,0,0);
    if(date-now>36*60*60*1000)date=new Date(now.getFullYear()-1,month-1,day,hour,minute,0,0);
    return date.getTime();
  }
  function isBreaking24h(article){
    if(!article.classList.contains('breaking'))return false;
    const ts=publishedAt(article);if(!Number.isFinite(ts))return false;
    const age=Date.now()-ts;return age>=-5*60*1000&&age<=24*60*60*1000;
  }
  function markActive(){Object.entries(filterCards).forEach(([key,card])=>card?.classList.toggle('filter-on',mode===key))}
  function applyMode(){
    const articles=[...list.querySelectorAll('.item')];
    articles.forEach(article=>{
      const score=scoreOf(article);
      const show=mode==='critical'?score>=82:mode==='high'?score>=75&&score<82:mode==='breaking'?isBreaking24h(article):true;
      article.classList.toggle('news-filter-hidden',!show);
    });
    markActive();
  }
  function resetAll(){
    mode='all';
    impact.value='55';
    impact.dispatchEvent(new Event('change',{bubbles:true}));
    queueMicrotask(applyMode);
  }
  function selectMode(next){
    mode=mode===next?'all':next;
    if(mode==='critical')impact.value='82';
    else if(mode==='high')impact.value='75';
    else impact.value='55';
    impact.dispatchEvent(new Event('change',{bubbles:true}));
    queueMicrotask(applyMode);
  }

  Object.entries(filterCards).forEach(([key,card])=>{
    if(!card)return;
    card.classList.add('news-filter');
    card.setAttribute('role','button');
    card.tabIndex=0;
    card.dataset.newsFilter=key;
    card.addEventListener('click',()=>selectMode(key));
    card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMode(key)}});
  });

  regions?.addEventListener('click',event=>{
    const button=event.target.closest('[data-region]');
    if(button?.dataset.region==='ALL')resetAll();
  });

  impact.addEventListener('change',()=>{
    if(mode==='breaking')return;
    const v=Number(impact.value);
    mode=v>=82?'critical':v>=75?'high':'all';
    markActive();
  });

  const listObserver=new MutationObserver(()=>queueMicrotask(applyMode));
  listObserver.observe(list,{childList:true});
  const title=$('title'),subtitle=$('subtitle');
  const titleObserver=new MutationObserver(()=>queueMicrotask(combineHeading));
  if(title)titleObserver.observe(title,{childList:true,characterData:true,subtree:true});
  if(subtitle)titleObserver.observe(subtitle,{childList:true,characterData:true,subtree:true});

  combineHeading();
  applyMode();
  window.CRYPTO_NEWS_UI_UPGRADES={get mode(){return mode},apply:applyMode,resetAll};
})();
