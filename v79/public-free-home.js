'use strict';
(() => {
  const patch={
    ru:{serverOk:'FREE Scanner работает',serverBad:'Ожидается свежий запуск Scanner',banner:'CRYPTO LAB v79 · PUBLIC FREE. Регистрация и основные функции бесплатны.',monitor:'Сигналы',mon:'A+ shadow · Telegram AUTO выключен',scannerBanner:'A+ анализ обновляется каждые 15 минут. Экспериментальные Telegram-сигналы не отправляются.',scannerDesc:'Свежий бесплатный shadow-анализ рынка без автоторговли и платных функций.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor',quickText:['Свечи, EMA, RSI и уровни','Бесплатный A+ shadow-анализ','Активы, P&L и структура']},
    uk:{serverOk:'FREE Scanner працює',serverBad:'Очікується свіжий запуск Scanner',banner:'CRYPTO LAB v79 · PUBLIC FREE. Реєстрація та основні функції безкоштовні.',monitor:'Сигнали',mon:'A+ shadow · Telegram AUTO вимкнено',scannerBanner:'A+ аналіз оновлюється кожні 15 хвилин. Експериментальні Telegram-сигнали не надсилаються.',scannerDesc:'Свіжий безкоштовний shadow-аналіз ринку без автоторгівлі та платних функцій.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor',quickText:['Свічки, EMA, RSI та рівні','Безкоштовний A+ shadow-аналіз','Активи, P&L та структура']},
    en:{serverOk:'FREE Scanner is running',serverBad:'Waiting for a fresh Scanner run',banner:'CRYPTO LAB v79 · PUBLIC FREE. Registration and core features are free.',monitor:'Signals',mon:'A+ shadow · Telegram AUTO is off',scannerBanner:'A+ analysis refreshes every 15 minutes. Experimental Telegram signals are not sent.',scannerDesc:'Fresh free shadow market analysis with no auto-trading or paid features.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor',quickText:['Candles, EMA, RSI and levels','Free A+ shadow analysis','Assets, P&L and allocation']}
  };
  try{Object.entries(patch).forEach(([key,value])=>Object.assign(T[key],value));}catch{}

  try{
    renderStatus=function(){
      const r=DATA.latest_run,now=Date.now();
      const fresh=!!(r?.finished_at&&now-new Date(r.finished_at).getTime()<35*60000);
      const scheduled=DATA.scanner_job?.active!==false;
      const ok=fresh&&scheduled;
      $('serverBox').className=ok?'server':'server bad';
      txt('serverText',ok?tr().serverOk:tr().serverBad);
      txt('homeScanner',ok?'ONLINE':'CHECK');$('homeScanner').className=ok?'pos':'neg';
      txt('homeMonitor','SHADOW');$('homeMonitor').className='pos';
      txt('sysScanner',ok?'ACTIVE':'CHECK');
      txt('sysMonitor','OFF');
      const live=$('scannerLive');if(live){live.className=ok?'live':'live off';txt('scannerLive',ok?'ONLINE':'CHECK');}
    };

    const baseRenderScanner=renderScanner;
    renderScanner=function(){
      baseRenderScanner();
      const r=DATA.latest_run||{};
      txt('sNew',r.class_a_found??0);
      txt('sTelegram','Telegram OFF');
      txt('monitorCheck','OFF · shadow only');
      const c=DATA.signal_counts||{};
      const shadow=Array.isArray(r.class_a)?r.class_a.length:(r.class_a_found??0);
      txt('signalCount',`${shadow} SHADOW · ${c.active||0} ACTIVE · ${c.closed||0} HISTORY`);
    };
  }catch(error){console.warn('Public FREE status patch unavailable',error);}

  const applyStatic=()=>{
    const ver=document.querySelector('.head .ver');if(ver)ver.textContent='v79 · PUBLIC FREE';
    const rows=document.querySelectorAll('.status .sys');
    rows.forEach(row=>{
      const name=row.querySelector('span')?.textContent||'',value=row.querySelector('b');
      if(!value)return;
      if(name==='signal-register'){row.querySelector('span').textContent='signal-quality';value.textContent='SHADOW';}
      if(name==='signal-monitor')value.textContent='OFF';
      if(name==='Telegram AUTO')value.textContent='OFF';
    });
  };
  applyStatic();
  try{translate();applyStatic();renderStatus();renderScanner();}catch{}
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(()=>{applyStatic();try{renderStatus();renderScanner();}catch{}},0));
})();