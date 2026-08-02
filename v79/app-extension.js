'use strict';
(() => {
  if (!ROUTES.some(route => route[0] === 'account')) ROUTES.push(['account', '⚙']);
  if (!T.ru.nav.includes('Аккаунт')) T.ru.nav.push('Аккаунт');
  if (!T.uk.nav.includes('Акаунт')) T.uk.nav.push('Акаунт');
  if (!T.en.nav.includes('Account')) T.en.nav.push('Account');

  const originalFrameUrl = frameUrl;
  const originalOpen = open;

  frameUrl = function(route, signal) {
    const params = new URLSearchParams({ lang });
    if (route === 'backtest') return './backtest.html?' + params.toString();
    if (route === 'account') return './account.html?' + params.toString();
    return originalFrameUrl(route, signal);
  };

  open = function(route, signal) {
    if (!['backtest', 'account'].includes(route)) return originalOpen(route, signal);
    current = route;
    $('nav').querySelectorAll('button').forEach(button => {
      button.classList.toggle('on', button.dataset.route === route);
    });
    $('side').classList.remove('open');
    ['homeView', 'scannerView', 'frameView', 'placeholderView'].forEach(id => $(id).classList.add('hide'));
    $('frameView').classList.remove('hide');
    $('frame').src = frameUrl(route, signal);
  };

  const frame = $('frame');
  const priorOnload = frame.onload;
  frame.onload = function(event) {
    if (typeof priorOnload === 'function') priorOnload.call(frame, event);
    if (current !== 'account') return;
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.getElementById('accountActionsScript')) return;
      const script = doc.createElement('script');
      script.id = 'accountActionsScript';
      script.src = './account-actions.js?v=7904';
      doc.head.appendChild(script);
    } catch (error) {
      console.warn('Account actions unavailable', error);
    }
  };

  translate();
})();