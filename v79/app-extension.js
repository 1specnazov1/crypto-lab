'use strict';
(() => {
  const originalFrameUrl = frameUrl;
  const originalOpen = open;

  frameUrl = function(route, signal) {
    if (route === 'backtest') {
      const p = new URLSearchParams({ lang });
      return './backtest.html?' + p.toString();
    }
    return originalFrameUrl(route, signal);
  };

  open = function(route, signal) {
    if (route !== 'backtest') return originalOpen(route, signal);
    current = route;
    $('nav').querySelectorAll('button').forEach(button => {
      button.classList.toggle('on', button.dataset.route === route);
    });
    $('side').classList.remove('open');
    ['homeView', 'scannerView', 'frameView', 'placeholderView'].forEach(id => $(id).classList.add('hide'));
    $('frameView').classList.remove('hide');
    $('frame').src = frameUrl(route, signal);
  };
})();