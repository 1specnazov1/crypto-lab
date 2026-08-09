'use strict';
(() => {
  try {
    const marketIndex=ROUTES.findIndex(r=>r[0]==='market');
    if(marketIndex>=0)ROUTES.splice(marketIndex,1);
    for(const code of ['ru','uk','en']){
      const nav=T?.[code]?.nav;
      if(Array.isArray(nav)&&nav.length>=3)nav.splice(1,1);
    }
    const labels={ru:'График и аналитика',uk:'Графік та аналітика',en:'Chart & analytics'};
    for(const code of ['ru','uk','en'])if(Array.isArray(T?.[code]?.nav)&&T[code].nav.length>1)T[code].nav[1]=labels[code];
    const baseTranslate=translate;
    translate=function mergedTranslate(){baseTranslate();const market=document.querySelector('#nav [data-route="market"]');market?.remove()};
    translate();
  } catch (e) { console.warn('route merge skipped',e); }
})();