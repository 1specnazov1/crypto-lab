'use strict';
(() => {
  const TEXT={
    ru:{why:'CRYPTO LAB сейчас работает бесплатно для приглашённых зарегистрированных пользователей. Все основные модули доступны на FREE. Лимиты используются только как защита от перегрузки и злоупотреблений.',plans:'Бесплатный доступ',access:'Бесплатно',free:'Все функции сайта · FREE',ai:'25 AI / день',scanner:'Scanner ∞',backtest:'50 Backtest / день',open:'Открыть CRYPTO LAB'},
    uk:{why:'CRYPTO LAB зараз працює безкоштовно для запрошених зареєстрованих користувачів. Усі основні модулі доступні на FREE. Ліміти використовуються лише як захист від перевантаження та зловживань.',plans:'Безкоштовний доступ',access:'Безкоштовно',free:'Усі функції сайту · FREE',ai:'25 AI / день',scanner:'Scanner ∞',backtest:'50 Backtest / день',open:'Відкрити CRYPTO LAB'},
    en:{why:'CRYPTO LAB is currently free for invited registered users. All core modules are available on FREE. Limits are used only for fair-use and abuse protection.',plans:'Free access',access:'Free',free:'All site features · FREE',ai:'25 AI / day',scanner:'Scanner ∞',backtest:'50 Backtests / day',open:'Open CRYPTO LAB'}
  };
  const locale=()=>typeof lang==='string'&&TEXT[lang]?lang:'ru';
  function apply(){
    const t=TEXT[locale()];
    const why=document.getElementById('whyText');if(why)why.textContent=t.why;
    const whyStats=document.querySelector('#authView .card:nth-child(2) .stats');
    if(whyStats)whyStats.innerHTML=`<div class="stat"><span>FREE</span><b>${t.ai}</b></div><div class="stat"><span>FREE</span><b>${t.scanner}</b></div><div class="stat"><span>FREE</span><b>${t.backtest}</b></div><div class="stat"><span>Security</span><b>RLS</b></div>`;
    const title=document.getElementById('plansTitle');if(title){title.textContent=t.plans;title.style.display='none';}
    const plans=document.getElementById('plans');if(plans)plans.style.display='none';
    const periodLabel=document.getElementById('periodLabel');if(periodLabel)periodLabel.textContent=t.plans;
    const periodEnd=document.getElementById('periodEnd');if(periodEnd)periodEnd.textContent=t.access;
    const badge=document.getElementById('planBadge');if(badge)badge.textContent='FREE';
    const actions=document.querySelector('.account-head > div:last-child');
    if(actions&&!document.getElementById('openCryptoLabBtn')){const button=document.createElement('button');button.id='openCryptoLabBtn';button.className='btn gold';button.textContent=t.open;button.onclick=()=>{location.href='./app.html';};actions.prepend(button);}else{const button=document.getElementById('openCryptoLabBtn');if(button)button.textContent=t.open;}
    document.body.dataset.accessMode='invite-free';
  }
  const hook=()=>{try{if(typeof loadAccount==='function'&&!loadAccount.__freeUiHooked){const original=loadAccount;const wrapped=async function(...args){const r=await original.apply(this,args);apply();return r};wrapped.__freeUiHooked=true;loadAccount=wrapped;}}catch{}apply();};
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(apply,0));
  window.addEventListener('message',event=>{if(event.data?.type==='crypto-lab-language')setTimeout(apply,0)});
  hook();setTimeout(apply,500);
})();