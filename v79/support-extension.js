'use strict';
(() => {
  const BUILD='7930free4';
  if (!ROUTES.some(route => route[0] === 'support')) ROUTES.push(['support', '❓']);
  if (!T.ru.nav.includes('Поддержка')) T.ru.nav.push('Поддержка');
  if (!T.uk.nav.includes('Підтримка')) T.uk.nav.push('Підтримка');
  if (!T.en.nav.includes('Support')) T.en.nav.push('Support');

  const previousFrameUrl = frameUrl;
  const previousOpen = open;
  const handled = new Set(['support','education']);

  frameUrl = function(route, signal) {
    const params = new URLSearchParams({ lang });
    if (route === 'support') return './support.html?' + params;
    if (route === 'education') return './education.html?' + params;
    return previousFrameUrl(route, signal);
  };

  open = function(route, signal) {
    if (!handled.has(route)) return previousOpen(route, signal);
    current = route;
    $('nav').querySelectorAll('button').forEach(button => button.classList.toggle('on', button.dataset.route === route));
    $('side').classList.remove('open');
    ['homeView', 'scannerView', 'frameView', 'placeholderView'].forEach(id => $(id).classList.add('hide'));
    $('frameView').classList.remove('hide');
    $('frame').src = frameUrl(route, signal);
  };

  const frame = $('frame');
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      const path = frame.contentWindow.location.pathname;
      if (!doc || !path.endsWith('/admin.html') || doc.getElementById('adminSupportScript')) return;
      const script = doc.createElement('script');
      script.id = 'adminSupportScript';
      script.src = `./admin-support.js?v=${BUILD}`;
      script.async = false;
      doc.head.appendChild(script);
    } catch (error) {
      console.warn('Support admin integration unavailable', error);
    }
  });

  translate();
  const requested = new URLSearchParams(location.search).get('route');
  if (handled.has(requested)) setTimeout(() => open(requested), 0);
})();