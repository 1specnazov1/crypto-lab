'use strict';
(() => {
  const patch={
    ru:{serverOk:'FREE Scanner работает',serverBad:'Ожидается свежий запуск Scanner',scannerBanner:'A+ анализ обновляется каждые 15 минут. Экспериментальные Telegram-сигналы не отправляются.',scannerDesc:'Свежий бесплатный shadow-анализ рынка без автоторговли и платных функций.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    uk:{serverOk:'FREE Scanner працює',serverBad:'Очікується свіжий запуск Scanner',scannerBanner:'A+ аналіз оновлюється кожні 15 хвилин. Експериментальні Telegram-сигнали не надсилаються.',scannerDesc:'Свіжий безкоштовний shadow-аналіз ринку без автоторгівлі та платних функцій.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    en:{serverOk:'FREE Scanner is running',serverBad:'Waiting for a fresh Scanner run',scannerBanner:'A+ analysis refreshes every 15 minutes. Experimental Telegram signals are not sent.',scannerDesc:'Fresh free shadow market analysis with no auto-trading or paid features.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'}
  };
  try{Object.entries(patch).forEach(([key,value])=>Object.assign(T[key],value));}catch{}
  if(document.getElementById('cryptoIntelligenceHomeScript'))return;
  const script=document.createElement('script');
  script.id='cryptoIntelligenceHomeScript';
  script.src='./home-intelligence.js?v=7930free20';
  script.async=false;
  document.body.appendChild(script);
})();
