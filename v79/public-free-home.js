'use strict';
(() => {
  const patch={
    ru:{serverOk:'FREE Scanner работает',serverBad:'Ожидается свежий запуск Scanner',scannerBanner:'A+ анализ обновляется каждые 15 минут. Экспериментальные Telegram-сигналы не отправляются.',scannerDesc:'Свежий бесплатный shadow-анализ рынка без автоторговли и платных функций.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    uk:{serverOk:'FREE Scanner працює',serverBad:'Очікується свіжий запуск Scanner',scannerBanner:'A+ аналіз оновлюється кожні 15 хвилин. Експериментальні Telegram-сигнали не надсилаються.',scannerDesc:'Свіжий безкоштовний shadow-аналіз ринку без автоторгівлі та платних функцій.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    en:{serverOk:'FREE Scanner is running',serverBad:'Waiting for a fresh Scanner run',scannerBanner:'A+ analysis refreshes every 15 minutes. Experimental Telegram signals are not sent.',scannerDesc:'Fresh free shadow market analysis with no auto-trading or paid features.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'}
  };
  try{Object.entries(patch).forEach(([key,value])=>Object.assign(T[key],value));}catch{}
  // app.js keeps language in a top-level lexical binding. Expose it to the
  // independently loaded intelligence module without duplicating language state.
  try{
    if(!Object.getOwnPropertyDescriptor(window,'lang')){
      Object.defineProperty(window,'lang',{configurable:true,get:()=>lang,set:value=>{lang=value;}});
    }
  }catch{}
  // The intelligence dashboard contains compact multi-column grids. Force every
  // child to shrink within the shell so long English/news strings never create
  // horizontal document overflow on desktop or mobile.
  if(!document.getElementById('cryptoIntelligenceHomeShellFix')){
    const style=document.createElement('style');
    style.id='cryptoIntelligenceHomeShellFix';
    style.textContent=`
      #homeView.ih{min-width:0;max-width:100%;overflow-x:hidden!important}
      #homeView.ih .ih-hero,#homeView.ih .ih-grid2,#homeView.ih .ih-grid3,#homeView.ih .ih-heat,#homeView.ih .ih-card,#homeView.ih .ih-pad,#homeView.ih .ih-newsrow,#homeView.ih .ih-risk,#homeView.ih .ih-row,#homeView.ih .ih-focusrow{min-width:0;max-width:100%}
      #homeView.ih .ih-th,#homeView.ih .ih-row{grid-template-columns:minmax(0,1.1fr) minmax(0,.55fr) minmax(0,.65fr) minmax(0,.65fr) minmax(0,.85fr)}
      #homeView.ih .ih-newsrow{grid-template-columns:auto minmax(0,1fr) auto}
      #homeView.ih .ih-newsrow>*,#homeView.ih .ih-risk>*,#homeView.ih .ih-row>*,#homeView.ih .ih-focusrow>*{min-width:0}
      #homeView.ih .ih-newsrow b,#homeView.ih .ih-newsrow small,#homeView.ih .ih-focusrow span,#homeView.ih .ih-state,#homeView.ih .ih-brief p{overflow-wrap:anywhere;word-break:break-word}
      @media(max-width:680px){#homeView.ih .ih-row{grid-template-columns:minmax(0,1fr) auto auto}}
    `;
    document.head.appendChild(style);
  }
  if(document.getElementById('cryptoIntelligenceHomeScript'))return;
  const script=document.createElement('script');
  script.id='cryptoIntelligenceHomeScript';
  script.src='./home-intelligence.js?v=7930free20';
  script.async=false;
  document.body.appendChild(script);
})();
