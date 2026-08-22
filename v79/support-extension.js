'use strict';
(() => {
  const BUILD='7931public1';
  try{
    const saved=localStorage.getItem('cryptoLabLanguage');
    if(!['ru','uk','en'].includes(saved||'')){localStorage.setItem('cryptoLabLanguage','en');lang='en';}
    else if(typeof lang==='string'&&!['ru','uk','en'].includes(lang))lang='en';
  }catch{if(typeof lang==='string')lang='en'}
  function loadRootScript(id,file){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=`./${file}?v=${BUILD}`;s.async=false;document.head.appendChild(s)}
  loadRootScript('cryptoFollowerAccessGuard','follower-access-guard.js');
  loadRootScript('freeLaunchInfoScript','free-launch-info.js');

  if (!ROUTES.some(route => route[0] === 'support')) ROUTES.push(['support', '❓']);
  if (!T.ru.nav.includes('Поддержка')) T.ru.nav.push('Поддержка');
  if (!T.uk.nav.includes('Підтримка')) T.uk.nav.push('Підтримка');
  if (!T.en.nav.includes('Support')) T.en.nav.push('Support');

  const previousFrameUrl = frameUrl;
  const previousOpen = open;
  const handled = new Set(['support','education']);
  const outerParams = new URLSearchParams(location.search);

  frameUrl = function(route, signal) {
    const params = new URLSearchParams({ lang });
    if (route === 'support') {
      const ticket=outerParams.get('ticket');
      if(ticket)params.set('ticket',ticket);
      return './support.html?' + params;
    }
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
  function injectAdminScript(doc,id,file){if(doc.getElementById(id))return;const script=doc.createElement('script');script.id=id;script.src=`./${file}?v=${BUILD}`;script.async=false;doc.head.appendChild(script);}
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      const path = frame.contentWindow.location.pathname;
      if (!doc || !path.endsWith('/admin.html')) return;
      injectAdminScript(doc,'adminSupportScript','admin-support.js');
      injectAdminScript(doc,'adminAccessScript','admin-access.js');
    } catch (error) {
      console.warn('Admin extensions unavailable', error);
    }
  });

  document.getElementById('refundLink')?.remove();
  translate();
  const requested = outerParams.get('route');
  if (handled.has(requested)) setTimeout(() => open(requested), 0);
})();
