'use strict';
(() => {
  const patch={
    ru:{serverOk:'FREE Scanner работает',serverBad:'Ожидается свежий запуск Scanner',scannerBanner:'A+ анализ обновляется каждые 15 минут. Экспериментальные Telegram-сигналы не отправляются.',scannerDesc:'Свежий бесплатный shadow-анализ рынка без автоторговли и платных функций.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    uk:{serverOk:'FREE Scanner працює',serverBad:'Очікується свіжий запуск Scanner',scannerBanner:'A+ аналіз оновлюється кожні 15 хвилин. Експериментальні Telegram-сигнали не надсилаються.',scannerDesc:'Свіжий безкоштовний shadow-аналіз ринку без автоторгівлі та платних функцій.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    en:{serverOk:'FREE Scanner is running',serverBad:'Waiting for a fresh Scanner run',scannerBanner:'A+ analysis refreshes every 15 minutes. Experimental Telegram signals are not sent.',scannerDesc:'Fresh free shadow market analysis with no auto-trading or paid features.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'}
  };
  try{Object.entries(patch).forEach(([key,value])=>Object.assign(T[key],value));}catch{}
  try{
    if(!Object.getOwnPropertyDescriptor(window,'lang')){
      Object.defineProperty(window,'lang',{configurable:true,get:()=>lang,set:value=>{lang=value;}});
    }
    // app.js stores dashboard state in a top-level `let DATA`, so it is not
    // automatically available as window.DATA. The intelligence homepage reads
    // window.DATA for Scanner health; expose the same live object instead of
    // maintaining a second copy.
    if(!Object.getOwnPropertyDescriptor(window,'DATA')){
      Object.defineProperty(window,'DATA',{configurable:true,get:()=>DATA});
    }
  }catch{}
  if(!document.getElementById('cryptoIntelligenceHomeShellFix')){
    const style=document.createElement('style');
    style.id='cryptoIntelligenceHomeShellFix';
    style.textContent=`
      .work{min-width:0}
      #homeView.ih{width:100%;min-width:0;max-width:100%;overflow-x:hidden!important}
      #homeView.ih>*{min-width:0;max-width:100%}
      #homeView.ih .ih-hero{width:100%;min-width:0;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr)}
      #homeView.ih .ih-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}
      #homeView.ih .ih-grid2{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}
      #homeView.ih .ih-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}
      #homeView.ih .ih-heat{grid-template-columns:repeat(6,minmax(0,1fr))}
      #homeView.ih .ih-card,#homeView.ih .ih-pad,#homeView.ih .ih-newsrow,#homeView.ih .ih-risk,#homeView.ih .ih-row,#homeView.ih .ih-focusrow,#homeView.ih .ih-metric,#homeView.ih .ih-tile{min-width:0;max-width:100%}
      #homeView.ih .ih-th,#homeView.ih .ih-row{grid-template-columns:minmax(0,1.1fr) minmax(0,.55fr) minmax(0,.65fr) minmax(0,.65fr) minmax(0,.85fr)}
      #homeView.ih .ih-newsrow{grid-template-columns:auto minmax(0,1fr) auto}
      #homeView.ih .ih-newsrow>*,#homeView.ih .ih-risk>*,#homeView.ih .ih-row>*,#homeView.ih .ih-focusrow>*{min-width:0}
      #homeView.ih .ih-newsrow b,#homeView.ih .ih-newsrow small,#homeView.ih .ih-focusrow span,#homeView.ih .ih-state,#homeView.ih .ih-brief p{overflow-wrap:anywhere;word-break:break-word}
      #homeView.ih .ih-actions>.ih-btn.main{display:inline-flex!important;grid-template-rows:none!important;width:auto!important;max-width:190px!important;height:38px!important;min-height:38px!important;max-height:38px!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;padding:7px 12px!important}
      @media(min-width:681px){
        html,body{max-width:100vw!important;overflow-x:hidden!important}
        .app{width:100vw!important;max-width:100vw!important;grid-template-columns:230px minmax(0,calc(100vw - 230px))!important;overflow:hidden!important}
        .main{width:calc(100vw - 230px)!important;max-width:calc(100vw - 230px)!important;min-width:0!important;overflow:hidden!important}
        .top,.work{width:100%!important;max-width:100%!important;min-width:0!important}
        .top .ticker{min-width:0!important;max-width:100%!important;overflow:hidden!important}
      }
      @media(max-width:1100px){
        #homeView.ih .ih-hero,#homeView.ih .ih-grid2{grid-template-columns:minmax(0,1fr)}
        #homeView.ih .ih-grid3{grid-template-columns:repeat(2,minmax(0,1fr))}
        #homeView.ih .ih-heat{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
      @media(max-width:680px){
        #homeView.ih .ih-grid3{grid-template-columns:minmax(0,1fr)}
        #homeView.ih .ih-heat{grid-template-columns:repeat(3,minmax(0,1fr))}
        #homeView.ih .ih-row{grid-template-columns:minmax(0,1fr) auto auto}
        #homeView.ih .ih-actions>.ih-btn.main{max-width:100%!important}
      }
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
