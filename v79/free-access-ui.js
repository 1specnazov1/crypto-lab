'use strict';
(() => {
  const TEXT={
    ru:{why:'CRYPTO LAB работает бесплатно для зарегистрированных пользователей, чья подписка на @CryptoLabPulse подтверждена через X. Дневные лимиты защищают сервис от перегрузки и злоупотреблений.',plans:'FREE · доступ подписчика',access:'Бесплатно',ai:'5 AI / день',chart:'Chart 100 / день',scanner:'Scanner ∞',smart:'Smart Money ∞',onchain:'On-Chain ∞',classic:'Classic 50 / день',exact:'EXACT 25 / день',open:'Открыть CRYPTO LAB',feedback:'Предложить улучшение'},
    uk:{why:'CRYPTO LAB працює безкоштовно для зареєстрованих користувачів, чию підписку на @CryptoLabPulse підтверджено через X. Денні ліміти захищають сервіс від перевантаження та зловживань.',plans:'FREE · доступ підписника',access:'Безкоштовно',ai:'5 AI / день',chart:'Chart 100 / день',scanner:'Scanner ∞',smart:'Smart Money ∞',onchain:'On-Chain ∞',classic:'Classic 50 / день',exact:'EXACT 25 / день',open:'Відкрити CRYPTO LAB',feedback:'Запропонувати покращення'},
    en:{why:'CRYPTO LAB is free for registered users whose follow of @CryptoLabPulse is verified through X. Daily fair-use limits protect the service from overload and abuse.',plans:'FREE · follower access',access:'Free',ai:'5 AI / day',chart:'Chart 100 / day',scanner:'Scanner ∞',smart:'Smart Money ∞',onchain:'On-Chain ∞',classic:'Classic 50 / day',exact:'EXACT 25 / day',open:'Open CRYPTO LAB',feedback:'Suggest an improvement'}
  };
  const locale=()=>typeof lang==='string'&&TEXT[lang]?lang:'en';
  function apply(){
    const t=TEXT[locale()];
    const why=document.getElementById('whyText');if(why)why.textContent=t.why;
    const whyStats=document.querySelector('#authView .card:nth-child(2) .stats');
    if(whyStats)whyStats.innerHTML=`<div class="stat"><span>FREE</span><b>${t.ai}</b></div><div class="stat"><span>FREE</span><b>${t.chart}</b></div><div class="stat"><span>FREE</span><b>${t.scanner}</b></div><div class="stat"><span>FREE</span><b>${t.smart}</b></div><div class="stat"><span>FREE</span><b>${t.onchain}</b></div><div class="stat"><span>FREE</span><b>${t.classic}</b></div><div class="stat"><span>FREE</span><b>${t.exact}</b></div>`;
    const title=document.getElementById('plansTitle');if(title){title.textContent=t.plans;title.style.display='none';}
    const plans=document.getElementById('plans');if(plans)plans.style.display='none';
    const periodLabel=document.getElementById('periodLabel');if(periodLabel)periodLabel.textContent=t.plans;
    const periodEnd=document.getElementById('periodEnd');if(periodEnd)periodEnd.textContent=t.access;
    const badge=document.getElementById('planBadge');if(badge)badge.textContent='FREE';
    const actions=document.querySelector('.account-head > div:last-child');
    if(actions&&!document.getElementById('openCryptoLabBtn')){const button=document.createElement('button');button.id='openCryptoLabBtn';button.className='btn gold';button.textContent=t.open;button.onclick=()=>{location.href='./app.html';};actions.prepend(button);}else{const button=document.getElementById('openCryptoLabBtn');if(button)button.textContent=t.open;}
    if(actions&&!document.getElementById('feedbackBtn')){const button=document.createElement('button');button.id='feedbackBtn';button.className='btn';button.textContent=t.feedback;button.onclick=()=>{location.href='./feedback.html';};actions.prepend(button);}else{const button=document.getElementById('feedbackBtn');if(button)button.textContent=t.feedback;}
    document.body.dataset.accessMode='x-follower-free';
  }
  const hook=()=>{try{if(typeof loadAccount==='function'&&!loadAccount.__freeUiHooked){const original=loadAccount;const wrapped=async function(...args){const r=await original.apply(this,args);apply();return r};wrapped.__freeUiHooked=true;loadAccount=wrapped;}}catch{}apply();};
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(apply,0));
  window.addEventListener('message',event=>{if(event.data?.type==='crypto-lab-language')setTimeout(apply,0)});
  hook();setTimeout(apply,500);
})();