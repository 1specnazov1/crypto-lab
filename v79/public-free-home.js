'use strict';
(() => {
  const NEWS_ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-news';
  const NEWS_KEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const MARKET_SYMBOLS=['BTC','ETH','SOL','XRP','BNB','DOGE','LINK','SUI','ADA','AVAX','ONDO','XLM'];
  const PORTFOLIO_KEY='cryptoLabV79Portfolio';
  const patch={
    ru:{serverOk:'FREE Scanner работает',serverBad:'Ожидается свежий запуск Scanner',scannerBanner:'A+ анализ обновляется каждые 15 минут. Экспериментальные Telegram-сигналы не отправляются.',scannerDesc:'Свежий бесплатный shadow-анализ рынка без автоторговли и платных функций.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    uk:{serverOk:'FREE Scanner працює',serverBad:'Очікується свіжий запуск Scanner',scannerBanner:'A+ аналіз оновлюється кожні 15 хвилин. Експериментальні Telegram-сигнали не надсилаються.',scannerDesc:'Свіжий безкоштовний shadow-аналіз ринку без автоторгівлі та платних функцій.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'},
    en:{serverOk:'FREE Scanner is running',serverBad:'Waiting for a fresh Scanner run',scannerBanner:'A+ analysis refreshes every 15 minutes. Experimental Telegram signals are not sent.',scannerDesc:'Fresh free shadow market analysis with no auto-trading or paid features.',newSignals:'Shadow A+',monitorChecked:'Telegram monitor'}
  };
  try{Object.entries(patch).forEach(([key,value])=>Object.assign(T[key],value));}catch{}

  const I18N={
    ru:{
      banner:'CRYPTO LAB v79 · FREE · Intelligence Dashboard',title:'Рынок за 30 секунд',desc:'Главная показывает не второй график, а то, что сейчас важно: режим рынка, возможности, риски, новости и персональный фокус.',live:'LIVE MARKET',loading:'анализируем рынок…',riskOn:'RISK ON',riskOff:'RISK OFF',mixed:'MIXED',
      briefUp:'Рынок преимущественно растёт. Сначала проверь лидеров движения и подтверждение объёмом, затем переходи к графику.',briefDown:'Рынок преимущественно снижается. Приоритет — защита капитала, слабые активы и подтверждённые уровни риска.',briefMixed:'Рынок смешанный: движение распределено неравномерно. Ищи относительную силу, но не принимай направление рынка как единый сигнал.',
      btc:'BTC 24ч',breadth:'Ширина рынка',avg:'Среднее движение',risk:'Risk Score',positive:'активов растут',basket:'по корзине 12',moderate:'умеренный',high:'повышенный',low:'низкий',
      oppTitle:'Opportunity Radar',oppSub:'Активы с максимальной рыночной активностью — это не торговые сигналы.',asset:'Актив',change:'24ч',volume:'Объём',activity:'Активность',state:'Состояние',strong:'сильнее рынка',weak:'слабее рынка',neutral:'нейтрально',
      riskTitle:'Risk Radar',riskSub:'Что может потребовать повышенного внимания прямо сейчас.',volatility:'Волатильность',volText:'Самое сильное абсолютное движение в корзине',breadthRisk:'Ширина рынка',breadthText:'Доля растущих активов в ключевой корзине',btcRisk:'BTC импульс',btcText:'24-часовое изменение Bitcoin',
      heatTitle:'Market Heatmap',heatSub:'Быстрый обзор лидеров и аутсайдеров без дублирования большого графика.',newsTitle:'News & Catalysts',newsSub:'Только события с высоким потенциальным влиянием на BTC/crypto.',newsWait:'Загружаем критические события…',newsEmpty:'Критических событий сейчас не найдено. Полный поток доступен в разделе «Новости».',impact:'Impact',
      focusTitle:'Сегодня в фокусе',focusSub:'Три вещи, которые стоит проверить в первую очередь.',focusMove:'Лидер движения',focusWeak:'Слабый актив',focusScanner:'Scanner A+',focusNews:'Главный катализатор',
      portfolioTitle:'Portfolio Snapshot',portfolioEmpty:'Портфель пока пуст. Добавь активы — и главная будет показывать стоимость, P&L и концентрацию.',portfolioValue:'Текущая стоимость',portfolioPnl:'Общий P&L',portfolioAssets:'активов',concentration:'крупнейшая позиция',
      systemTitle:'System Health',scanner:'Market Scanner',signals:'Signal Quality',telegram:'Telegram AUTO',data:'Market Data',shadow:'SHADOW',off:'OFF',online:'ONLINE',check:'CHECK',
      chartBtn:'Открыть график',scannerBtn:'Открыть Scanner',newsBtn:'Новости',portfolioBtn:'Портфель',quickTitle:'Быстрые действия',updated:'Обновлено'
    },
    uk:{
      banner:'CRYPTO LAB v79 · FREE · Intelligence Dashboard',title:'Ринок за 30 секунд',desc:'Головна показує не другий графік, а те, що зараз важливо: режим ринку, можливості, ризики, новини та персональний фокус.',live:'LIVE MARKET',loading:'аналізуємо ринок…',riskOn:'RISK ON',riskOff:'RISK OFF',mixed:'MIXED',
      briefUp:'Ринок переважно зростає. Спочатку перевір лідерів руху та підтвердження обсягом, потім переходь до графіка.',briefDown:'Ринок переважно знижується. Пріоритет — захист капіталу, слабкі активи та підтверджені рівні ризику.',briefMixed:'Ринок змішаний: рух розподілений нерівномірно. Шукай відносну силу, але не сприймай напрям ринку як єдиний сигнал.',
      btc:'BTC 24г',breadth:'Ширина ринку',avg:'Середній рух',risk:'Risk Score',positive:'активів зростають',basket:'за кошиком 12',moderate:'помірний',high:'підвищений',low:'низький',
      oppTitle:'Opportunity Radar',oppSub:'Активи з максимальною ринковою активністю — це не торгові сигнали.',asset:'Актив',change:'24г',volume:'Обсяг',activity:'Активність',state:'Стан',strong:'сильніше ринку',weak:'слабше ринку',neutral:'нейтрально',
      riskTitle:'Risk Radar',riskSub:'Що може потребувати підвищеної уваги прямо зараз.',volatility:'Волатильність',volText:'Найсильніший абсолютний рух у кошику',breadthRisk:'Ширина ринку',breadthText:'Частка активів, що зростають, у ключовому кошику',btcRisk:'BTC імпульс',btcText:'24-годинна зміна Bitcoin',
      heatTitle:'Market Heatmap',heatSub:'Швидкий огляд лідерів та аутсайдерів без дублювання великого графіка.',newsTitle:'News & Catalysts',newsSub:'Лише події з високим потенційним впливом на BTC/crypto.',newsWait:'Завантажуємо критичні події…',newsEmpty:'Критичних подій зараз не знайдено. Повний потік доступний у розділі «Новини».',impact:'Impact',
      focusTitle:'Сьогодні у фокусі',focusSub:'Три речі, які варто перевірити насамперед.',focusMove:'Лідер руху',focusWeak:'Слабкий актив',focusScanner:'Scanner A+',focusNews:'Головний каталізатор',
      portfolioTitle:'Portfolio Snapshot',portfolioEmpty:'Портфель поки порожній. Додай активи — і головна показуватиме вартість, P&L та концентрацію.',portfolioValue:'Поточна вартість',portfolioPnl:'Загальний P&L',portfolioAssets:'активів',concentration:'найбільша позиція',
      systemTitle:'System Health',scanner:'Market Scanner',signals:'Signal Quality',telegram:'Telegram AUTO',data:'Market Data',shadow:'SHADOW',off:'OFF',online:'ONLINE',check:'CHECK',
      chartBtn:'Відкрити графік',scannerBtn:'Відкрити Scanner',newsBtn:'Новини',portfolioBtn:'Портфель',quickTitle:'Швидкі дії',updated:'Оновлено'
    },
    en:{
      banner:'CRYPTO LAB v79 · FREE · Intelligence Dashboard',title:'Market in 30 seconds',desc:'The home page does not repeat the full chart. It surfaces what matters now: market regime, opportunities, risks, catalysts and personal focus.',live:'LIVE MARKET',loading:'analyzing market…',riskOn:'RISK ON',riskOff:'RISK OFF',mixed:'MIXED',
      briefUp:'The market is broadly advancing. Check the strongest movers and volume confirmation first, then move to the full chart.',briefDown:'The market is broadly declining. Capital protection, weak assets and validated risk levels take priority.',briefMixed:'The market is mixed and uneven. Look for relative strength, but do not treat the market as one directional signal.',
      btc:'BTC 24h',breadth:'Market breadth',avg:'Average move',risk:'Risk Score',positive:'assets rising',basket:'12-asset basket',moderate:'moderate',high:'elevated',low:'low',
      oppTitle:'Opportunity Radar',oppSub:'Assets with the highest market activity — not trading signals.',asset:'Asset',change:'24h',volume:'Volume',activity:'Activity',state:'State',strong:'stronger than market',weak:'weaker than market',neutral:'neutral',
      riskTitle:'Risk Radar',riskSub:'What may require extra attention right now.',volatility:'Volatility',volText:'Largest absolute move in the basket',breadthRisk:'Market breadth',breadthText:'Share of rising assets in the core basket',btcRisk:'BTC impulse',btcText:'Bitcoin 24-hour change',
      heatTitle:'Market Heatmap',heatSub:'Fast leaders/laggards overview without duplicating the full chart.',newsTitle:'News & Catalysts',newsSub:'Only events with high potential impact on BTC/crypto.',newsWait:'Loading critical events…',newsEmpty:'No critical events detected now. The full feed is available in News.',impact:'Impact',
      focusTitle:'Today’s Focus',focusSub:'Three things to inspect first.',focusMove:'Momentum leader',focusWeak:'Weak asset',focusScanner:'Scanner A+',focusNews:'Top catalyst',
      portfolioTitle:'Portfolio Snapshot',portfolioEmpty:'Portfolio is empty. Add assets and the dashboard will show value, P&L and concentration.',portfolioValue:'Current value',portfolioPnl:'Total P&L',portfolioAssets:'assets',concentration:'largest position',
      systemTitle:'System Health',scanner:'Market Scanner',signals:'Signal Quality',telegram:'Telegram AUTO',data:'Market Data',shadow:'SHADOW',off:'OFF',online:'ONLINE',check:'CHECK',
      chartBtn:'Open chart',scannerBtn:'Open Scanner',newsBtn:'News',portfolioBtn:'Portfolio',quickTitle:'Quick actions',updated:'Updated'
    }
  };

  const home=()=>document.getElementById('homeView');
  const h=id=>document.getElementById(id);
  const L=()=>I18N[lang]||I18N.ru;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>`${Number(v)>=0?'+':''}${Number(v||0).toFixed(2)}%`;
  const compact=n=>{const x=Number(n);if(!Number.isFinite(x))return '—';if(x>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(x>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(x>=1e3)return '$'+(x/1e3).toFixed(1)+'K';return '$'+x.toFixed(0)};
  const money=n=>'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const priceFmt=n=>{const x=Number(n);if(!Number.isFinite(x))return '—';return x>=1000?x.toLocaleString('en-US',{maximumFractionDigits:2}):x>=1?x.toLocaleString('en-US',{maximumFractionDigits:5}):x.toLocaleString('en-US',{maximumFractionDigits:8})};
  let market=[],news=[],marketOk=false,lastMarketRefresh=null;

  function injectStyles(){
    if(document.getElementById('intelligenceHomeStyles'))return;
    const s=document.createElement('style');s.id='intelligenceHomeStyles';s.textContent=`
      #homeView.ih{--ih-bg:#11161d;--ih-bg2:#0f141a;--ih-line:#28313c;--ih-muted:#7d8998;--ih-green:#13d998;--ih-red:#ff5d73;--ih-gold:#f0b90b;--ih-blue:#5aa7ff;display:block}
      .ih *{box-sizing:border-box}.ih .ih-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #5d4b00;background:linear-gradient(90deg,#19170d,#11161c 70%);border-radius:10px;padding:10px 12px;color:#f4d765;font-size:10px}.ih .ih-banner b{color:#fff}.ih .ih-badge{border:1px solid #725d00;border-radius:7px;padding:5px 7px;font-weight:900;white-space:nowrap}
      .ih .ih-hero{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr);gap:10px;margin-top:10px}.ih .ih-card{background:linear-gradient(180deg,#151b23,#11161d);border:1px solid var(--ih-line);border-radius:11px}.ih .ih-brief{padding:18px;min-height:214px;position:relative;overflow:hidden}.ih .ih-brief:after{content:'';position:absolute;width:330px;height:330px;border-radius:50%;right:-120px;top:-160px;background:radial-gradient(circle,#f0b90b15,#f0b90b00 68%);pointer-events:none}.ih .ih-eye{color:#8996a6;font-size:9px;font-weight:900;letter-spacing:.11em}.ih .ih-regime{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:6px 9px;border:1px solid #315b50;background:#10201c;color:#8cf0cc;border-radius:999px;font-size:10px;font-weight:950}.ih .ih-dot{width:7px;height:7px;border-radius:50%;background:var(--ih-green);box-shadow:0 0 0 4px #13d99814}.ih .ih-regime.riskoff{border-color:#72323c;background:#241216;color:#ff9aaa}.ih .ih-regime.riskoff .ih-dot{background:var(--ih-red);box-shadow:0 0 0 4px #ff5d7314}.ih .ih-regime.mixed{border-color:#6e5b1b;background:#211c0f;color:#f2d36a}.ih .ih-regime.mixed .ih-dot{background:var(--ih-gold);box-shadow:0 0 0 4px #f0b90b14}.ih .ih-brief h1{font-size:25px;line-height:1.12;margin:11px 0 7px;letter-spacing:-.025em}.ih .ih-brief p{max-width:850px;margin:0;color:#9aa6b5;line-height:1.55;font-size:12px}.ih .ih-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.ih .ih-action{border:1px solid #303a46;background:#181f27;color:#e7edf4;border-radius:8px;padding:8px 11px;font-size:10px;font-weight:850;cursor:pointer}.ih .ih-action.primary{background:#e5b600;color:#0b0d10;border-color:#8f7200}
      .ih .ih-pulse{padding:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.ih .ih-metric{background:#0e1319;border:1px solid #222b35;border-radius:9px;padding:11px}.ih .ih-metric span{display:block;color:#7d8998;font-size:9px}.ih .ih-metric strong{display:block;margin-top:5px;font-size:18px}.ih .ih-metric small{display:block;margin-top:3px;color:#7f8b99;font-size:9px}.ih .pos{color:var(--ih-green)!important}.ih .neg{color:var(--ih-red)!important}
      .ih .ih-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:18px 2px 8px}.ih .ih-head h2{margin:0;font-size:15px}.ih .ih-head p{margin:3px 0 0;color:#788494;font-size:10px}.ih .ih-tag{border:1px solid #2b3540;border-radius:999px;padding:5px 8px;color:#8996a5;font-size:9px}.ih .ih-grid2{display:grid;grid-template-columns:1.16fr .84fr;gap:10px}.ih .ih-pad{padding:13px}.ih .ih-table-head,.ih .ih-opp{display:grid;grid-template-columns:1.1fr .55fr .65fr .65fr .85fr;gap:8px;align-items:center}.ih .ih-table-head{padding:0 8px 8px;color:#6e7a89;font-size:9px}.ih .ih-opp{padding:9px 8px;border-top:1px solid #232c36}.ih .ih-asset{display:flex;gap:8px;align-items:center;font-weight:850}.ih .ih-coin{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#1b232d;font-size:9px;font-weight:950}.ih .ih-score{display:inline-flex;justify-content:center;border:1px solid #30594e;background:#0d211b;color:#79e8c1;border-radius:7px;padding:5px 6px;font-size:9px;font-weight:900}.ih .ih-state{color:#8e9baa;font-size:9px}.ih .ih-riskstack{display:grid;gap:8px}.ih .ih-riskitem{display:grid;grid-template-columns:36px 1fr auto;gap:9px;align-items:center;border:1px solid #232c36;background:#0e1319;border-radius:9px;padding:9px}.ih .ih-ricon{display:grid;place-items:center;width:34px;height:34px;background:#1a222b;border-radius:8px;font-size:15px}.ih .ih-riskitem b{font-size:10px}.ih .ih-riskitem span{display:block;margin-top:2px;color:#7f8b99;font-size:9px;line-height:1.35}.ih .ih-rbadge{padding:5px 7px;border-radius:7px;font-size:9px;font-weight:900}.ih .ih-rbadge.high{border:1px solid #73323d;background:#241216;color:#ff92a2}.ih .ih-rbadge.mid{border:1px solid #66551b;background:#211c0f;color:#f1d36a}.ih .ih-rbadge.low{border:1px solid #285848;background:#0d211a;color:#7be6bf}
      .ih .ih-heat{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.ih .ih-tile{min-height:68px;border-radius:9px;padding:8px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid #ffffff10}.ih .ih-tile b{font-size:10px}.ih .ih-tile strong{font-size:14px}.ih .ih-tile small{color:#d7dde5aa;font-size:9px}.ih .ih-news{display:grid;gap:8px}.ih .ih-newsrow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;border:1px solid #232c36;background:#0e1319;border-radius:9px;padding:9px}.ih .ih-newstype{padding:5px 6px;border-radius:6px;background:#1a222b;color:#9aa6b5;font-size:8px;font-weight:900}.ih .ih-newsrow b{display:block;font-size:10px;line-height:1.3}.ih .ih-newsrow span{display:block;margin-top:3px;color:#778494;font-size:9px}.ih .ih-impact{color:#f2cf54;font-size:9px;font-weight:900}
      .ih .ih-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.ih .ih-focus{display:grid;gap:7px}.ih .ih-focusrow{display:flex;gap:8px;align-items:flex-start;border:1px solid #232c36;background:#0e1319;border-radius:9px;padding:8px}.ih .ih-focusrow i{font-style:normal;color:var(--ih-gold);font-weight:950}.ih .ih-focusrow b{font-size:10px}.ih .ih-focusrow span{display:block;margin-top:2px;color:#7d8998;font-size:9px;line-height:1.35}.ih .ih-portfolio{border:1px solid #293440;background:#0e1319;border-radius:9px;padding:11px}.ih .ih-portfolio strong{display:block;font-size:21px}.ih .ih-portfolio span{display:block;margin-top:3px;color:#7d8998;font-size:9px}.ih .ih-portgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.ih .ih-portmini{border-top:1px solid #242d37;padding-top:8px}.ih .ih-portmini b{display:block;font-size:11px}.ih .ih-portmini span{font-size:8px}.ih .ih-sysrows{display:grid;gap:7px}.ih .ih-sysrow{display:flex;justify-content:space-between;gap:8px;border:1px solid #232c36;background:#0e1319;border-radius:8px;padding:8px}.ih .ih-sysrow span{color:#7d8998;font-size:9px}.ih .ih-sysrow b{font-size:9px}.ih #quick{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.ih #quick button{border:1px solid #28333e;background:#111821;color:#dfe6ee;border-radius:8px;padding:9px;text-align:left}.ih #quick b{display:block;font-size:9px}.ih #quick span{display:block;margin-top:2px;color:#798594;font-size:8px}.ih .ih-compat{display:none!important}.ih .ih-foot{margin-top:16px;color:#5f6b79;text-align:center;font-size:9px}
      @media(max-width:1100px){.ih .ih-hero,.ih .ih-grid2{grid-template-columns:1fr}.ih .ih-grid3{grid-template-columns:1fr 1fr}.ih .ih-heat{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:680px){.ih .ih-brief{padding:14px;min-height:auto}.ih .ih-brief h1{font-size:21px}.ih .ih-pulse{grid-template-columns:1fr 1fr}.ih .ih-grid3{grid-template-columns:1fr}.ih .ih-heat{grid-template-columns:repeat(3,1fr)}.ih .ih-table-head{display:none}.ih .ih-opp{grid-template-columns:1fr auto auto}.ih .ih-opp>*:nth-child(3),.ih .ih-opp>*:nth-child(4){display:none}.ih #quick{grid-template-columns:1fr}.ih .ih-banner{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function shell(){
    const el=home();if(!el)return;el.classList.add('ih');
    el.innerHTML=`
      <div class="ih-banner" id="banner"><span><b>CRYPTO LAB</b> · ${esc(L().banner)}</span><span class="ih-badge">v79 · FREE</span></div>
      <div class="ih-hero">
        <section class="ih-card ih-brief"><div class="ih-eye">MARKET INTELLIGENCE · 30-SECOND BRIEF</div><div class="ih-regime mixed" id="ihRegime"><i class="ih-dot"></i><span>${esc(L().loading)}</span></div><h1 id="title">${esc(L().title)}</h1><p id="desc">${esc(L().desc)}</p><div class="ih-actions"><button class="ih-action primary" data-home-route="analytics">${esc(L().chartBtn)} →</button><button class="ih-action" data-home-route="scanner">${esc(L().scannerBtn)}</button><button class="ih-action" data-home-route="news">⚡ ${esc(L().newsBtn)}</button><button class="ih-action" data-home-route="portfolio">${esc(L().portfolioBtn)}</button></div></section>
        <section class="ih-card ih-pulse"><div class="ih-metric"><span id="btcLabel">${esc(L().btc)}</span><strong id="statBtc">—</strong><small id="change">—</small></div><div class="ih-metric"><span>${esc(L().breadth)}</span><strong id="ihBreadth">—</strong><small id="ihBreadthText">—</small></div><div class="ih-metric"><span>${esc(L().avg)}</span><strong id="ihAvg">—</strong><small>${esc(L().basket)}</small></div><div class="ih-metric"><span>${esc(L().risk)}</span><strong id="ihRisk">—</strong><small id="ihRiskText">—</small></div></section>
      </div>
      <div class="ih-head"><div><h2>${esc(L().oppTitle)}</h2><p>${esc(L().oppSub)}</p></div><span class="ih-tag">${esc(L().live)}</span></div>
      <div class="ih-grid2"><section class="ih-card ih-pad"><div class="ih-table-head"><span>${esc(L().asset)}</span><span>${esc(L().change)}</span><span>${esc(L().volume)}</span><span>${esc(L().activity)}</span><span>${esc(L().state)}</span></div><div id="ihOpps"><div class="ih-opp"><span>${esc(L().loading)}</span></div></div></section><section class="ih-card ih-pad"><div class="ih-riskstack" id="ihRisks"><div class="ih-riskitem"><div class="ih-ricon">◌</div><div><b>${esc(L().riskTitle)}</b><span>${esc(L().loading)}</span></div><span class="ih-rbadge mid">—</span></div></div></section></div>
      <div class="ih-head"><div><h2>${esc(L().heatTitle)}</h2><p>${esc(L().heatSub)}</p></div><span class="ih-tag">12 ASSETS</span></div><section class="ih-card ih-pad"><div class="ih-heat" id="ihHeat"></div></section>
      <div class="ih-head"><div><h2>${esc(L().newsTitle)}</h2><p>${esc(L().newsSub)}</p></div><button class="ih-action" data-home-route="news">${esc(L().newsBtn)} →</button></div><section class="ih-card ih-pad"><div class="ih-news" id="ihNews"><div class="ih-newsrow"><span class="ih-newstype">LIVE</span><div><b>${esc(L().newsWait)}</b></div><span class="ih-impact">—</span></div></div></section>
      <div class="ih-head"><div><h2>${esc(L().focusTitle)}</h2><p>${esc(L().focusSub)}</p></div></div>
      <div class="ih-grid3"><section class="ih-card ih-pad"><div class="ih-focus" id="ihFocus"></div></section><section class="ih-card ih-pad"><h3 style="margin:0 0 9px;font-size:12px">${esc(L().portfolioTitle)}</h3><div id="ihPortfolio"></div></section><section class="ih-card ih-pad"><h3 id="statusTitle" style="margin:0 0 9px;font-size:12px">${esc(L().systemTitle)}</h3><div class="ih-sysrows"><div class="ih-sysrow"><span>${esc(L().scanner)}</span><b id="homeScanner">${esc(L().check)}</b></div><div class="ih-sysrow"><span>${esc(L().signals)}</span><b class="pos">${esc(L().shadow)}</b></div><div class="ih-sysrow"><span>${esc(L().telegram)}</span><b>${esc(L().off)}</b></div><div class="ih-sysrow"><span>${esc(L().data)}</span><b id="ihMarketStatus">${esc(L().check)}</b></div></div><h3 style="margin:12px 0 0;font-size:11px">${esc(L().quickTitle)}</h3><div id="quick"></div></section></div>
      <div class="ih-foot"><span id="ihUpdated">${esc(L().updated)}: —</span></div>
      <div class="ih-compat"><span id="scannerLabel"></span><span id="homeScannerText"></span><span id="monitorLabel"></span><b id="homeMonitor"></b><span id="homeMonitorText"></span><span id="langLabel"></span><span id="saved"></span><b id="sysScanner"></b><b id="sysMonitor"></b></div>`;
    const q=h('quick');if(q)q.innerHTML=`<button data-home-route="analytics"><b>${esc(L().chartBtn)}</b><span>EMA · FIB · ON-CHAIN</span></button><button data-home-route="scanner"><b>${esc(L().scannerBtn)}</b><span>A+ SHADOW</span></button><button data-home-route="portfolio"><b>${esc(L().portfolioBtn)}</b><span>P&L · allocation</span></button>`;
    el.querySelectorAll('[data-home-route]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.homeRoute)));
  }

  function riskLabel(score){return score>=67?L().high:score>=38?L().moderate:L().low}
  function riskClass(score){return score>=67?'high':score>=38?'mid':'low'}
  function marketMetrics(){
    if(!market.length)return null;
    const changes=market.map(x=>Number(x.priceChangePercent)||0),positive=changes.filter(x=>x>0).length,breadth=positive/market.length*100,avg=changes.reduce((a,b)=>a+b,0)/changes.length;
    const meanAbs=changes.reduce((a,b)=>a+Math.abs(b),0)/changes.length,variance=changes.reduce((a,b)=>a+(b-avg)**2,0)/changes.length,dispersion=Math.sqrt(variance);
    const risk=Math.max(0,Math.min(100,Math.round(meanAbs*9+dispersion*7)));
    const btc=market.find(x=>x.base==='BTC')||market[0];
    const regime=breadth>=65&&Number(btc?.priceChangePercent)>=0?'on':breadth<=35&&Number(btc?.priceChangePercent)<=0?'off':'mixed';
    return {positive,breadth,avg,risk,btc,regime,meanAbs,dispersion};
  }

  function renderMarket(){
    const m=marketMetrics();if(!m)return;
    const regime=h('ihRegime');regime.className='ih-regime '+(m.regime==='off'?'riskoff':m.regime==='mixed'?'mixed':'');regime.querySelector('span').textContent=m.regime==='on'?L().riskOn:m.regime==='off'?L().riskOff:L().mixed;
    h('desc').textContent=m.regime==='on'?L().briefUp:m.regime==='off'?L().briefDown:L().briefMixed;
    h('statBtc').textContent='$'+priceFmt(m.btc?.lastPrice);h('change').textContent=pct(m.btc?.priceChangePercent);h('change').className=Number(m.btc?.priceChangePercent)>=0?'pos':'neg';
    h('ihBreadth').textContent=Math.round(m.breadth)+'%';h('ihBreadth').className=m.breadth>=55?'pos':m.breadth<=45?'neg':'';h('ihBreadthText').textContent=`${m.positive}/${market.length} ${L().positive}`;
    h('ihAvg').textContent=pct(m.avg);h('ihAvg').className=m.avg>=0?'pos':'neg';h('ihRisk').textContent=String(m.risk);h('ihRisk').className=m.risk>=67?'neg':m.risk<38?'pos':'';h('ihRiskText').textContent=riskLabel(m.risk);
    h('ihMarketStatus').textContent=L().online;h('ihMarketStatus').className='pos';
    const maxVol=Math.max(...market.map(x=>Math.log10(Number(x.quoteVolume)||1))),minVol=Math.min(...market.map(x=>Math.log10(Number(x.quoteVolume)||1));
    const ranked=market.map(x=>{const c=Number(x.priceChangePercent)||0,lv=Math.log10(Number(x.quoteVolume)||1),vn=(lv-minVol)/(maxVol-minVol||1);const score=Math.max(1,Math.min(99,Math.round(Math.abs(c)*9+vn*35)));return {...x,activity:score}}).sort((a,b)=>b.activity-a.activity).slice(0,5);
    h('ihOpps').innerHTML=ranked.map(x=>{const c=Number(x.priceChangePercent)||0,state=c>m.avg+1?L().strong:c<m.avg-1?L().weak:L().neutral;return `<div class="ih-opp"><div class="ih-asset"><span class="ih-coin">${esc(x.base)}</span><b>${esc(x.base)}</b></div><b class="${c>=0?'pos':'neg'}">${pct(c)}</b><span>${compact(x.quoteVolume)}</span><span class="ih-score">${x.activity}</span><span class="ih-state">${esc(state)}</span></div>`}).join('');
    const mostVol=[...market].sort((a,b)=>Math.abs(Number(b.priceChangePercent))-Math.abs(Number(a.priceChangePercent)))[0];
    const breadthScore=Math.round(Math.abs(m.breadth-50)*2),btcScore=Math.min(100,Math.round(Math.abs(Number(m.btc?.priceChangePercent)||0)*14));
    const riskRows=[
      ['↕',L().volatility,`${mostVol.base} ${pct(mostVol.priceChangePercent)} · ${L().volText}`,Math.min(100,Math.round(Math.abs(Number(mostVol.priceChangePercent))*14))],
      ['◫',L().breadthRisk,`${Math.round(m.breadth)}% · ${L().breadthText}`,breadthScore],
      ['₿',L().btcRisk,`${pct(m.btc?.priceChangePercent)} · ${L().btcText}`,btcScore]
    ];
    h('ihRisks').innerHTML=riskRows.map(([icon,title,text,score])=>`<div class="ih-riskitem"><div class="ih-ricon">${icon}</div><div><b>${esc(title)}</b><span>${esc(text)}</span></div><span class="ih-rbadge ${riskClass(score)}">${score}</span></div>`).join('');
    h('ihHeat').innerHTML=market.map(x=>{const c=Number(x.priceChangePercent)||0,intensity=Math.min(.3,.08+Math.abs(c)/35),bg=c>=0?`rgba(19,217,152,${intensity})`:`rgba(255,93,115,${intensity})`;return `<div class="ih-tile" style="background:${bg}"><b>${esc(x.base)}</b><strong class="${c>=0?'pos':'neg'}">${pct(c)}</strong><small>$${priceFmt(x.lastPrice)}</small></div>`}).join('');
    renderFocus();renderPortfolio();lastMarketRefresh=new Date();h('ihUpdated').textContent=`${L().updated}: ${new Intl.DateTimeFormat(lang==='uk'?'uk-UA':lang==='en'?'en-GB':'ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(lastMarketRefresh)}`;
  }

  function scannerSnapshot(){const r=DATA?.latest_run||{},now=Date.now(),fresh=!!(r.finished_at&&now-new Date(r.finished_at).getTime()<35*60000),scheduled=DATA?.scanner_job?.active!==false;return {ok:fresh&&scheduled,shadow:Array.isArray(r.class_a)?r.class_a.length:Number(r.class_a_found)||0,finished:r.finished_at};}
  function renderSystem(){const s=scannerSnapshot(),v=h('homeScanner');if(v){v.textContent=s.ok?L().online:L().check;v.className=s.ok?'pos':'neg'};const sys=h('sysScanner');if(sys)sys.textContent=s.ok?'ACTIVE':'CHECK';const mon=h('homeMonitor');if(mon)mon.textContent=L().shadow;const sm=h('sysMonitor');if(sm)sm.textContent='OFF';const box=h('serverBox');if(box)box.className=s.ok?'server':'server bad';const text=h('serverText');if(text)text.textContent=s.ok?tr().serverOk:tr().serverBad;const live=h('scannerLive');if(live){live.className=s.ok?'live':'live off';live.textContent=s.ok?'ONLINE':'CHECK'};renderFocus();}

  function renderFocus(){
    const m=marketMetrics();if(!m)return;const leader=[...market].sort((a,b)=>Number(b.priceChangePercent)-Number(a.priceChangePercent))[0],weak=[...market].sort((a,b)=>Number(a.priceChangePercent)-Number(b.priceChangePercent))[0],s=scannerSnapshot(),topNews=news[0];
    const rows=[
      ['01',L().focusMove,`${leader.base} ${pct(leader.priceChangePercent)} · ${L().strong}`],
      ['02',L().focusWeak,`${weak.base} ${pct(weak.priceChangePercent)} · ${L().weak}`],
      ['03',L().focusScanner,`${s.shadow} SHADOW A+ · ${s.ok?L().online:L().check}`]
    ];
    if(topNews)rows[2]=['03',L().focusNews,`${topNews.region||'GLOBAL'} · ${String(topNews.title||'').slice(0,90)}`];
    h('ihFocus').innerHTML=rows.map(([i,t,x])=>`<div class="ih-focusrow"><i>${i}</i><div><b>${esc(t)}</b><span>${esc(x)}</span></div></div>`).join('');
  }

  async function portfolioPrices(rows){
    const bases=[...new Set(rows.map(x=>String(x.symbol||'').toUpperCase()).filter(Boolean))];if(!bases.length)return {};
    const fromMarket=Object.fromEntries(market.filter(x=>bases.includes(x.base)).map(x=>[x.base,Number(x.lastPrice)]));const missing=bases.filter(x=>!Number.isFinite(fromMarket[x]));if(!missing.length)return fromMarket;
    try{const pairs=missing.map(x=>x+'USDT'),url='https://api.binance.com/api/v3/ticker/price?symbols='+encodeURIComponent(JSON.stringify(pairs)),r=await fetch(url,{cache:'no-store'}),d=await r.json();if(Array.isArray(d))d.forEach(x=>{fromMarket[x.symbol.replace(/USDT$/,'')]=Number(x.price)});}catch{}return fromMarket;
  }
  async function renderPortfolio(){
    let rows=[];try{const parsed=JSON.parse(localStorage.getItem(PORTFOLIO_KEY)||'[]');rows=Array.isArray(parsed)?parsed.filter(x=>x&&x.symbol&&Number(x.amount)>0):[]}catch{}
    const box=h('ihPortfolio');if(!box)return;if(!rows.length){box.innerHTML=`<div class="ih-portfolio"><strong>—</strong><span>${esc(L().portfolioEmpty)}</span></div>`;return;}
    const pxs=await portfolioPrices(rows),items=rows.map(x=>{const amount=Number(x.amount),avg=Number(x.avg)||0,px=Number(pxs[x.symbol]??avg),invested=amount*avg,value=amount*px;return {...x,invested,value,pnl:value-invested}}),total=items.reduce((s,x)=>s+x.value,0),invested=items.reduce((s,x)=>s+x.invested,0),pnl=total-invested,largest=[...items].sort((a,b)=>b.value-a.value)[0],share=total?largest.value/total*100:0;
    box.innerHTML=`<div class="ih-portfolio"><strong>${money(total)}</strong><span>${esc(L().portfolioValue)} · ${items.length} ${esc(L().portfolioAssets)}</span><div class="ih-portgrid"><div class="ih-portmini"><b class="${pnl>=0?'pos':'neg'}">${pnl>=0?'+':''}${money(pnl)}</b><span>${esc(L().portfolioPnl)}</span></div><div class="ih-portmini"><b>${esc(largest.symbol)} · ${share.toFixed(1)}%</b><span>${esc(L().concentration)}</span></div></div></div>`;
  }

  function authToken(){try{const raw=localStorage.getItem('sb-txhzxbizjpinowepfjkm-auth-token');if(!raw)return'';const v=JSON.parse(raw);return String(v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||'')}catch{return''}}
  async function loadNews(){
    const box=h('ihNews');if(!box)return;const tk=authToken();if(!tk){box.innerHTML=`<div class="ih-newsrow"><span class="ih-newstype">NEWS</span><div><b>${esc(L().newsEmpty)}</b></div><span class="ih-impact">→</span></div>`;return;}
    try{const r=await fetch(NEWS_ENDPOINT+'?limit=12&min_impact=70',{headers:{Authorization:`Bearer ${tk}`,apikey:NEWS_KEY},cache:'no-store'}),j=await r.json();if(!r.ok||!j?.ok)throw Error();news=(j.breaking||j.items||[]).slice(0,3);if(!news.length){box.innerHTML=`<div class="ih-newsrow"><span class="ih-newstype">NEWS</span><div><b>${esc(L().newsEmpty)}</b></div><span class="ih-impact">—</span></div>`;return;}box.innerHTML=news.map(x=>`<div class="ih-newsrow"><span class="ih-newstype">${esc(x.region||'GLOBAL')}</span><div><b>${esc(x.title)}</b><span>${esc(x?.metadata?.source_name||x.domain||'')}</span></div><span class="ih-impact">${esc(L().impact)} ${esc(x.impact_score??'—')}</span></div>`).join('');renderFocus();}catch{box.innerHTML=`<div class="ih-newsrow"><span class="ih-newstype">NEWS</span><div><b>${esc(L().newsEmpty)}</b></div><span class="ih-impact">→</span></div>`;}
  }

  async function apiMarket(path){let last;for(const base of ['https://data-api.binance.vision','https://api.binance.com']){try{const r=await fetch(base+path,{cache:'no-store'});if(!r.ok)throw Error();return await r.json()}catch(e){last=e}}throw last||Error('market')}
  async function loadMarket(){
    try{const pairs=MARKET_SYMBOLS.map(x=>x+'USDT'),d=await apiMarket('/api/v3/ticker/24hr?symbols='+encodeURIComponent(JSON.stringify(pairs)));if(!Array.isArray(d))throw Error();market=d.map(x=>({...x,base:x.symbol.replace(/USDT$/,'')})).filter(x=>MARKET_SYMBOLS.includes(x.base));marketOk=market.length>=8;renderMarket();}catch{marketOk=false;const st=h('ihMarketStatus');if(st){st.textContent=L().check;st.className='neg';}}
  }

  const baseRenderScanner=typeof renderScanner==='function'?renderScanner:null;
  if(baseRenderScanner)renderScanner=function intelligenceScanner(){baseRenderScanner();const r=DATA.latest_run||{};txt('sNew',r.class_a_found??0);txt('sTelegram','Telegram OFF');txt('monitorCheck','OFF · shadow only');const c=DATA.signal_counts||{},shadow=Array.isArray(r.class_a)?r.class_a.length:(r.class_a_found??0);txt('signalCount',`${shadow} SHADOW · ${c.active||0} ACTIVE · ${c.closed||0} HISTORY`);renderSystem();};
  renderStatus=function intelligenceStatus(){renderSystem();};

  const baseTranslate=typeof translate==='function'?translate:null;
  if(baseTranslate)translate=function intelligenceTranslate(){baseTranslate();shell();renderSystem();if(marketOk)renderMarket();loadNews();};

  injectStyles();
  try{baseTranslate?.();}catch(error){console.warn('base translation unavailable',error)}
  shell();renderSystem();
  try{loadDashboard();}catch{}
  loadMarket();loadNews();renderPortfolio();
  setInterval(loadMarket,60000);setInterval(loadNews,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadMarket();loadNews();renderPortfolio();}});
})();
