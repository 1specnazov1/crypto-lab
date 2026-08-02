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

  translate();
})();