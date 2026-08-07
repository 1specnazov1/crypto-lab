'use strict';
(() => {
  const COPY={
    ru:{badge:'ЗАКРЫТАЯ BETA · ПЛАТЕЖИ ВЫКЛЮЧЕНЫ',headline:'Сигналы, аналитика и управление риском в одном CRYPTO LAB',lead:'Сканер рынка, сценарии входа, Stop/TP, журнал, бэктест, AI-пояснения и автоматические сигналы. Без обещаний прибыли — только инструменты для системной работы.',features:[['24/7 Scanner','Серверный сканер и мониторинг торговых сценариев.'],['Risk First','Размер позиции, Stop Loss, цели и контроль риска перед сделкой.'],['One Workspace','Графики, журнал, портфель, бэктест и AI-анализ в одной панели.']],month:'/ месяц',basic:['Основной терминал и рыночные инструменты','Сканер и базовые сигналы','Калькулятор риска и журнал'],pro:['Всё из BASIC','Расширенные сигналы и аналитика','Расширенный AI/бэктест и профессиональные лимиты'],cta:'Доступ откроется после закрытой beta',notice:'Коммерческий запуск ещё не активирован. Эта страница — кандидат v79: она не принимает оплату, не включает подписку и не гарантирует доступ. Реальные платежи и регистрация будут включены только после отдельного решения владельца и успешной beta.',partner:'Код партнёра сохранён локально для будущей beta: ',terms:'Условия',privacy:'Конфиденциальность',refund:'Возвраты',risk:'Риски',riskText:'CRYPTO LAB не является гарантией прибыли. Торговля цифровыми активами связана с риском частичной или полной потери капитала.'},
    uk:{badge:'ЗАКРИТА BETA · ПЛАТЕЖІ ВИМКНЕНО',headline:'Сигнали, аналітика та керування ризиком в одному CRYPTO LAB',lead:'Сканер ринку, сценарії входу, Stop/TP, журнал, бектест, AI-пояснення та автоматичні сигнали. Без обіцянок прибутку — лише інструменти для системної роботи.',features:[['24/7 Scanner','Серверний сканер і моніторинг торгових сценаріїв.'],['Risk First','Розмір позиції, Stop Loss, цілі та контроль ризику до угоди.'],['One Workspace','Графіки, журнал, портфель, бектест та AI-аналіз в одній панелі.']],month:'/ місяць',basic:['Основний термінал і ринкові інструменти','Сканер і базові сигнали','Калькулятор ризику та журнал'],pro:['Усе з BASIC','Розширені сигнали та аналітика','Розширений AI/бектест і професійні ліміти'],cta:'Доступ відкриється після закритої beta',notice:'Комерційний запуск ще не активовано. Ця сторінка — кандидат v79: вона не приймає оплату, не вмикає підписку й не гарантує доступ. Реальні платежі та реєстрацію буде ввімкнено лише після окремого рішення власника та успішної beta.',partner:'Код партнера збережено локально для майбутньої beta: ',terms:'Умови',privacy:'Конфіденційність',refund:'Повернення',risk:'Ризики',riskText:'CRYPTO LAB не гарантує прибуток. Торгівля цифровими активами пов’язана з ризиком часткової або повної втрати капіталу.'},
    en:{badge:'CLOSED BETA · PAYMENTS DISABLED',headline:'Signals, analytics and risk management in one CRYPTO LAB workspace',lead:'Market scanner, entry scenarios, Stop/TP, journal, backtesting, AI explanations and automated signals. No profit promises — tools for a systematic workflow.',features:[['24/7 Scanner','Server-side market scanning and trade-scenario monitoring.'],['Risk First','Position sizing, Stop Loss, targets and risk controls before a trade.'],['One Workspace','Charts, journal, portfolio, backtesting and AI analysis in one interface.']],month:'/ month',basic:['Core terminal and market tools','Scanner and core signals','Risk calculator and journal'],pro:['Everything in BASIC','Advanced signals and analytics','Advanced AI/backtesting and professional limits'],cta:'Access opens after closed beta',notice:'Commercial launch is not active yet. This v79 candidate does not accept payment, activate subscriptions, or guarantee access. Real payments and registration will be enabled only after a separate owner decision and successful beta.',partner:'Partner code stored locally for future beta: ',terms:'Terms',privacy:'Privacy',refund:'Refunds',risk:'Risks',riskText:'CRYPTO LAB does not guarantee profit. Digital-asset trading can result in partial or total loss of capital.'}
  };
  const qs=new URLSearchParams(location.search);
  const langSelect=document.getElementById('lang');
  const requested=qs.get('lang');
  let lang=['ru','uk','en'].includes(requested)?requested:(localStorage.getItem('crypto_lang')||'ru');
  if(!COPY[lang])lang='ru';
  langSelect.value=lang;

  const sanitizeCode=value=>/^[A-Za-z0-9_-]{3,32}$/.test(value||'')?value:'';
  const ref=sanitizeCode(qs.get('ref'));
  const campaign=/^[A-Za-z0-9_-]{1,64}$/.test(qs.get('campaign')||'')?qs.get('campaign'):'';
  if(ref)sessionStorage.setItem('crypto_referral_preview',ref);
  if(campaign)sessionStorage.setItem('crypto_campaign_preview',campaign);

  function render(){
    const c=COPY[lang];document.documentElement.lang=lang==='uk'?'uk':lang;
    document.getElementById('badge').textContent=c.badge;document.getElementById('headline').textContent=c.headline;document.getElementById('lead').textContent=c.lead;
    document.getElementById('features').innerHTML=c.features.map(([h,p])=>`<article class="card"><h3>${h}</h3><p>${p}</p></article>`).join('');
    document.getElementById('month1').textContent=c.month;document.getElementById('month2').textContent=c.month;
    document.getElementById('basicList').innerHTML=c.basic.map(x=>`<li>${x}</li>`).join('');document.getElementById('proList').innerHTML=c.pro.map(x=>`<li>${x}</li>`).join('');
    document.getElementById('basicCta').textContent=c.cta;document.getElementById('proCta').textContent=c.cta;document.getElementById('notice').textContent=c.notice;
    const stored=sessionStorage.getItem('crypto_referral_preview')||'';document.getElementById('ref').textContent=stored?c.partner+stored:'';
    for(const [id,label] of [['terms',c.terms],['privacy',c.privacy],['refund',c.refund],['risk',c.risk]]){const a=document.getElementById(id);a.textContent=label;a.href=a.getAttribute('href').split('?')[0]+'?lang='+encodeURIComponent(lang);}
    document.getElementById('riskText').textContent=c.riskText;
  }
  langSelect.addEventListener('change',()=>{lang=langSelect.value;localStorage.setItem('crypto_lang',lang);render();});
  render();
})();
