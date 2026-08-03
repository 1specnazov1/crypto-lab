'use strict';
(() => {
  if (window.__cryptoLabA11yReady) return;
  window.__cryptoLabA11yReady = true;
  const BUILD='7929';
  const routeNames={ru:{home:'Главная',market:'Рынок',analytics:'Аналитика',scanner:'Сканер',ai:'AI-анализ',portfolio:'Портфель',calculator:'Калькулятор',backtest:'Бэктест',journal:'Журнал',education:'Обучение',support:'Поддержка',account:'Аккаунт'},uk:{home:'Головна',market:'Ринок',analytics:'Аналітика',scanner:'Сканер',ai:'AI-аналіз',portfolio:'Портфель',calculator:'Калькулятор',backtest:'Бектест',journal:'Журнал',education:'Навчання',support:'Підтримка',account:'Акаунт'},en:{home:'Home',market:'Market',analytics:'Analytics',scanner:'Scanner',ai:'AI analysis',portfolio:'Portfolio',calculator:'Calculator',backtest:'Backtest',journal:'Journal',education:'Education',support:'Support',account:'Account'}};
  const labels={ru:{skip:'Перейти к основному содержанию',menu:'Открыть меню',nav:'Основная навигация',lang:'Язык интерфейса',frame:'Модуль CRYPTO LAB',updated:'Открыт раздел',chart:'Открыть интерактивный график BTC',status:'Статус сигналов',direction:'Направление сделки',timeframe:'Таймфрейм',search:'Поиск монеты',table:'Таблица сигналов'},uk:{skip:'Перейти до основного вмісту',menu:'Відкрити меню',nav:'Основна навігація',lang:'Мова інтерфейсу',frame:'Модуль CRYPTO LAB',updated:'Відкрито розділ',chart:'Відкрити інтерактивний графік BTC',status:'Статус сигналів',direction:'Напрямок угоди',timeframe:'Таймфрейм',search:'Пошук монети',table:'Таблиця сигналів'},en:{skip:'Skip to main content',menu:'Open menu',nav:'Primary navigation',lang:'Interface language',frame:'CRYPTO LAB module',updated:'Opened section',chart:'Open interactive BTC chart',status:'Signal status',direction:'Trade direction',timeframe:'Timeframe',search:'Search asset',table:'Signals table'}};
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const language=()=>document.getElementById('lang')?.value||localStorage.getItem('cryptoLabLanguage')||'ru';
  const copy=()=>labels[language()]||labels.ru;
  const routeLabel=route=>(routeNames[language()]||routeNames.ru)[route]||route||copy().frame;

  function style(){
    if(document.getElementById('cryptoA11yStyle'))return;
    const node=document.createElement('style');node.id='cryptoA11yStyle';node.textContent=`
      .crypto-skip-link{position:fixed;left:12px;top:8px;z-index:9999;padding:10px 14px;border-radius:8px;background:#f0b90b;color:#111;font-weight:900;transform:translateY(-180%);transition:transform .15s ease}.crypto-skip-link:focus{transform:translateY(0)}
      :where(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #4d9fff!important;outline-offset:2px!important}
      :where(button,.btn,[role="button"]){min-height:40px}
      .crypto-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;document.head.appendChild(node);
  }

  function ensureSkipLink(){
    let link=document.getElementById('cryptoSkipLink');
    const main=document.querySelector('main');
    if(!main)return;
    if(!main.id)main.id='mainContent';
    if(!main.hasAttribute('tabindex'))main.tabIndex=-1;
    if(!link){link=document.createElement('a');link.id='cryptoSkipLink';link.className='crypto-skip-link';link.href='#'+main.id;document.body.prepend(link);link.addEventListener('click',event=>{event.preventDefault();main.focus({preventScroll:false});main.scrollIntoView({block:'start'});});}
    link.textContent=copy().skip;
  }

  function currentRoute(){return document.querySelector('#nav button.on')?.dataset.route||'home';}
  function announce(route){
    let live=document.getElementById('cryptoRouteAnnouncer');
    if(!live){live=document.createElement('div');live.id='cryptoRouteAnnouncer';live.className='crypto-sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.appendChild(live);}
    live.textContent=`${copy().updated}: ${routeLabel(route)}`;
  }

  function labelControl(element,fallback){
    if(!element||element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')||element.getAttribute('title'))return;
    if(element.id&&document.querySelector(`label[for="${CSS.escape(element.id)}"]`))return;
    if(clean(element.textContent))return;
    element.setAttribute('aria-label',fallback||clean(element.placeholder)||element.id||'Action');
  }

  function bindKeyboardClick(element,label){
    if(!element)return;
    element.setAttribute('role','button');element.tabIndex=0;element.setAttribute('aria-label',label);
    if(element.dataset.a11yKeyboardBound)return;element.dataset.a11yKeyboardBound='1';
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();element.click();}});
  }

  function enhance(){
    const selectedLanguage=language();document.documentElement.lang=selectedLanguage==='uk'?'uk':selectedLanguage==='en'?'en':'ru';
    ensureSkipLink();
    const nav=document.getElementById('nav');if(nav)nav.setAttribute('aria-label',copy().nav);
    const side=document.getElementById('side');
    const menu=document.getElementById('menu');
    if(menu){menu.setAttribute('aria-label',copy().menu);menu.setAttribute('title',copy().menu);menu.setAttribute('aria-controls','side');menu.setAttribute('aria-expanded',String(Boolean(side?.classList.contains('open'))));}
    const lang=document.getElementById('lang');if(lang)lang.setAttribute('aria-label',copy().lang);
    const explicit={statusFilter:copy().status,dirFilter:copy().direction,tfFilter:copy().timeframe,searchFilter:copy().search};
    Object.entries(explicit).forEach(([id,label])=>document.getElementById(id)?.setAttribute('aria-label',label));
    document.querySelectorAll('#nav button').forEach(button=>{
      const route=button.dataset.route||'';button.setAttribute('aria-label',routeLabel(route));
      if(button.classList.contains('on'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    ['serverBox','scannerLive','networkText','message','msg'].forEach(id=>{const node=document.getElementById(id);if(node){node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');}});
    ['installApp','updateApp','refreshBtn'].forEach(id=>{const button=document.getElementById(id);if(button)labelControl(button,clean(button.textContent)||id);});
    document.querySelectorAll('button,input,select,textarea,a[href]').forEach(element=>labelControl(element,clean(element.placeholder)||element.id||element.name||'Action'));
    document.querySelectorAll('a[target="_blank"]').forEach(link=>{link.rel='noopener noreferrer';});
    const chart=document.getElementById('homeChartCard');if(chart)bindKeyboardClick(chart,copy().chart);
    document.querySelectorAll('table').forEach(table=>{if(!table.getAttribute('aria-label')&&!table.querySelector('caption'))table.setAttribute('aria-label',copy().table);});
    const frame=document.getElementById('frame');if(frame)frame.title=`${copy().frame}: ${routeLabel(currentRoute())}`;
  }

  function injectModuleA11y(){
    const frame=document.getElementById('frame');
    try{
      const doc=frame?.contentDocument;if(!doc||doc.getElementById('moduleAccessibilityScript'))return;
      const script=doc.createElement('script');script.id='moduleAccessibilityScript';script.src=`./module-accessibility.js?v=${BUILD}`;doc.head.appendChild(script);
    }catch(error){console.warn('Module accessibility unavailable',error);}
  }

  style();enhance();
  const frame=document.getElementById('frame');
  frame?.addEventListener('load',()=>{enhance();injectModuleA11y();announce(currentRoute());});
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(()=>{enhance();announce(currentRoute());},0));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const side=document.getElementById('side');if(side?.classList.contains('open')){side.classList.remove('open');document.getElementById('menu')?.focus();enhance();}}});
  new MutationObserver(()=>requestAnimationFrame(enhance)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']});
})();