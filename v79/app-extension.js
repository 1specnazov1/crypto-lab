'use strict';
(() => {
  const BUILD = '7906';
  if (!ROUTES.some(route => route[0] === 'account')) ROUTES.push(['account', '⚙']);
  if (!T.ru.nav.includes('Аккаунт')) T.ru.nav.push('Аккаунт');
  if (!T.uk.nav.includes('Акаунт')) T.uk.nav.push('Акаунт');
  if (!T.en.nav.includes('Account')) T.en.nav.push('Account');

  const originalFrameUrl = frameUrl;
  const originalOpen = open;
  const framed = new Set(['scanner', 'ai', 'backtest', 'journal', 'account']);

  frameUrl = function(route, signal) {
    const params = new URLSearchParams({ lang });
    if (route === 'scanner') return './scanner.html?' + params;
    if (route === 'ai') return './ai.html?' + params;
    if (route === 'backtest') return './backtest.html?' + params;
    if (route === 'journal') return './journal.html?' + params;
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
      <div class="legal-links"><a href="./risk-disclosure.html" target="_blank" rel="noopener">Риски</a><a href="./privacy.html" target="_blank" rel="noopener">Privacy</a><a href="./terms.html" target="_blank" rel="noopener">Условия</a></div>`;
    foot.appendChild(tools);
  }

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
    addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js?v=' + BUILD, { scope: './' }).catch(error => console.warn('PWA registration failed', error)));
  }

  const frame = $('frame');
  const priorOnload = frame.onload;
  frame.onload = function(event) {
    if (typeof priorOnload === 'function') priorOnload.call(frame, event);
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      if (current === 'journal' && !doc.getElementById('journalPnlSignFix')) {
        const style = doc.createElement('style');
        style.id = 'journalPnlSignFix';
        style.textContent = '#netPnl.neg::before,tbody td:nth-child(11).neg::before{content:"−"}';
        doc.head.appendChild(style);
      }
      if (current !== 'account' || doc.getElementById('accountActionsScript')) return;
      const script = doc.createElement('script');
      script.id = 'accountActionsScript';
      script.src = './account-actions.js?v=' + BUILD;
      doc.head.appendChild(script);
    } catch (error) {
      console.warn('Frame enhancements unavailable', error);
    }
  };

  addEventListener('error', event => console.error('CRYPTO LAB UI error', event.error || event.message));
  addEventListener('unhandledrejection', event => console.error('CRYPTO LAB promise error', event.reason));
  translate();
  const requestedRoute = new URLSearchParams(location.search).get('route');
  if (requestedRoute && ROUTES.some(route => route[0] === requestedRoute)) setTimeout(() => open(requestedRoute), 0);
})();