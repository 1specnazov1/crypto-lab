'use strict';
(() => {
  const BUILD = '7930pwa3';
  if (!ROUTES.some(route => route[0] === 'account')) ROUTES.push(['account', '⚙']);
  if (!T.ru.nav.includes('Аккаунт')) T.ru.nav.push('Аккаунт');
  if (!T.uk.nav.includes('Акаунт')) T.uk.nav.push('Акаунт');
  if (!T.en.nav.includes('Account')) T.en.nav.push('Account');

  const originalFrameUrl = frameUrl;
  const originalOpen = open;
  const framed = new Set(['scanner', 'ai', 'backtest', 'journal', 'account']);
  const journalKeys = ['symbol','direction','tf','entry','entryLow','entryHigh','stop','tp','tp2','tp3','sourceSignal','signalStatus','strength','signalTime'];

  frameUrl = function(route, signal) {
    const params = new URLSearchParams({ lang });
    if (route === 'scanner') return './scanner.html?' + params;
    if (route === 'ai') return './ai.html?' + params;
    if (route === 'backtest') return './backtest.html?' + params;
    if (route === 'journal') {
      const source = signal ? new URLSearchParams() : new URLSearchParams(location.search);
      if (signal) {
        const low = Number(signal.entry_low), high = Number(signal.entry_high), last = Number(signal.last_price);
        const hasLow = Number.isFinite(low) && low > 0, hasHigh = Number.isFinite(high) && high > 0, hasLast = Number.isFinite(last) && last > 0;
        const midpoint = hasLow && hasHigh ? (low + high) / 2 : hasLow ? low : hasHigh ? high : hasLast ? last : null;
        const entry = signal.entry_notified && hasLast ? last : midpoint;
        source.set('symbol', signal.symbol || 'BTC');
        source.set('direction', signal.direction || 'LONG');
        source.set('tf', signal.timeframe || '1H');
        source.set('sourceSignal', String(signal.id || ''));
        source.set('signalStatus', signal.status || 'WAITING');
        if (entry !== null) source.set('entry', String(entry));
        [['entryLow',signal.entry_low],['entryHigh',signal.entry_high],['stop',signal.stop],['tp',signal.tp1],['tp2',signal.tp2],['tp3',signal.tp3],['strength',signal.strength]].forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')source.set(key,String(value))});
        const signalTime = signal.activated_at || signal.created_at || signal.updated_at;
        if (signalTime) source.set('signalTime', signalTime);
      }
      journalKeys.forEach(key => { if (source.has(key)) params.set(key, source.get(key)); });
      return './journal.html?' + params;
    }
    if (route === 'account') return './account.html?' + params;
    return originalFrameUrl(route, signal);
  };

  open = function(route, signal) {
    if (!framed.has(route)) return originalOpen(route, signal);
    current = route;
    $('nav').querySelectorAll('button').forEach(button => button.classList.toggle('on', button.dataset.route === route));
    $('side').classList.remove('open');
    ['homeView', 'scannerView', 'frameView', 'placeholderView'].forEach(id => $(id).classList.add('hide'));
    $('frameView').classList.remove('hide');
    $('frame').src = frameUrl(route, signal);
  };

  function addHeadLink(rel, href, extra = {}) {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    Object.assign(link, extra);
    document.head.appendChild(link);
  }

  addHeadLink('manifest', './manifest.webmanifest?v=' + BUILD);
  addHeadLink('icon', './icon.svg?v=' + BUILD, { type: 'image/svg+xml' });
  addHeadLink('apple-touch-icon', './icon.svg?v=' + BUILD);
  addHeadLink('stylesheet', './platform.css?v=' + BUILD);
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ',viewport-fit=cover';

  const foot = document.querySelector('.foot');
  if (foot && !document.getElementById('platformTools')) {
    const tools = document.createElement('div');
    tools.id = 'platformTools';
    tools.className = 'platform-tools';
    tools.innerHTML = `
      <div class="platform-status"><span id="networkDot"></span><b id="networkText">ONLINE</b></div>
      <button id="installApp" hidden>Установить приложение</button>
      <button id="updateApp" hidden>Обновить приложение</button>
      <div class="legal-links"><a id="riskLink" target="_blank" rel="noopener">Риски</a><a id="privacyLink" target="_blank" rel="noopener">Privacy</a><a id="termsLink" target="_blank" rel="noopener">Условия</a><a id="refundLink" target="_blank" rel="noopener">Возвраты</a></div>`;
    foot.appendChild(tools);
  }

  function updateLegalLinks() {
    const labels = {
      ru: { risk:'Риски', privacy:'Конфиденциальность', terms:'Условия', refund:'Возвраты' },
      uk: { risk:'Ризики', privacy:'Конфіденційність', terms:'Умови', refund:'Повернення' },
      en: { risk:'Risks', privacy:'Privacy', terms:'Terms', refund:'Refunds' }
    }[lang] || { risk:'Риски', privacy:'Конфиденциальность', terms:'Условия', refund:'Возвраты' };
    const params = '?lang=' + encodeURIComponent(lang);
    const map = {
      riskLink:['./risk-disclosure.html' + params,labels.risk],
      privacyLink:['./privacy.html' + params,labels.privacy],
      termsLink:['./terms.html' + params,labels.terms],
      refundLink:['./refund.html' + params,labels.refund]
    };
    Object.entries(map).forEach(([id,[href,label]]) => { const link=document.getElementById(id); if(link){link.href=href;link.textContent=label;} });
  }
  updateLegalLinks();
  document.getElementById('lang')?.addEventListener('change', () => setTimeout(updateLegalLinks, 0));

  function networkState() {
    const online = navigator.onLine;
    const dot = document.getElementById('networkDot');
    const text = document.getElementById('networkText');
    if (dot) dot.className = online ? 'on' : 'off';
    if (text) text.textContent = online ? 'ONLINE' : 'OFFLINE';
  }
  addEventListener('online', networkState);
  addEventListener('offline', networkState);
  networkState();

  let installPrompt = null;
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const button = document.getElementById('installApp');
    if (button) button.hidden = false;
  });
  const installButton = document.getElementById('installApp');
  if (installButton) installButton.onclick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    installButton.hidden = true;
  };

  if ('serviceWorker' in navigator) {
    addEventListener('load', async () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js?v=' + BUILD, { scope: './', updateViaCache: 'none' });
        const updateButton = document.getElementById('updateApp');
        const showUpdate = () => { if (updateButton) updateButton.hidden = false; };
        if (registration.waiting) showUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          });
        });
        if (updateButton) updateButton.onclick = () => {
          updateButton.disabled = true;
          if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          else registration.update();
        };
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController || reloading) return;
          reloading = true;
          location.reload();
        });
        registration.update().catch(() => {});
      } catch (error) {
        console.warn('PWA registration failed', error);
      }
    });
  }

  function injectScript(doc, id, source) {
    if (doc.getElementById(id)) return;
    const script = doc.createElement('script');
    script.id = id;
    script.src = source + '?v=' + BUILD;
    doc.head.appendChild(script);
  }

  function injectStylesheet(doc, id, source) {
    if (doc.getElementById(id)) return;
    const link = doc.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = source + '?v=' + BUILD;
    doc.head.appendChild(link);
  }

  const frame = $('frame');
  const priorOnload = frame.onload;
  frame.onload = function(event) {
    if (typeof priorOnload === 'function') priorOnload.call(frame, event);
    try {
      const doc = frame.contentDocument;
      const path = frame.contentWindow.location.pathname;
      if (!doc) return;
      if (path.endsWith('.html')) injectStylesheet(doc, 'moduleMobileStyles', './module-mobile.css');
      if (path.endsWith('/scanner.html')) injectScript(doc, 'scannerActionsScript', './scanner-actions.js');
      if (path.endsWith('/backtest.html')) injectScript(doc, 'backtestHistoryScript', './backtest-history.js');
      if (path.endsWith('/journal.html')) {
        if (!doc.getElementById('journalPnlSignFix')) {
          const style = doc.createElement('style');
          style.id = 'journalPnlSignFix';
          style.textContent = '#netPnl.neg::before,tbody td:nth-child(11).neg::before{content:"−"}';
          doc.head.appendChild(style);
        }
        injectScript(doc, 'journalImportScript', './journal-import.js');
        injectScript(doc, 'journalAnalyticsScript', './journal-analytics.js');
      }
      if (path.endsWith('/admin.html')) {
        injectScript(doc, 'adminHealthScript', './admin-health.js');
        injectScript(doc, 'adminDeletionScript', './admin-deletions.js');
        injectScript(doc, 'adminTelemetryScript', './admin-telemetry.js');
        injectScript(doc, 'adminAiTelemetryScript', './admin-ai-telemetry.js');
      }
    } catch (error) {
      console.warn('Frame enhancements unavailable', error);
    }
  };

  addEventListener('error', event => console.error('CRYPTO LAB UI error', event.error || event.message));
  addEventListener('unhandledrejection', event => console.error('CRYPTO LAB promise error', event.reason));
  translate();
  updateLegalLinks();
  const requestedRoute = new URLSearchParams(location.search).get('route');
  if (requestedRoute && ROUTES.some(route => route[0] === requestedRoute)) setTimeout(() => {
    open(requestedRoute);
    history.replaceState(null, '', location.pathname);
  }, 0);
})();