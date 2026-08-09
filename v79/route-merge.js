'use strict';
(() => {
  function injectAnalyticsTools(){
    const frame=document.getElementById('frame');
    if(!frame)return;
    let doc;
    try{doc=frame.contentDocument}catch{return}
    if(!doc||!doc.getElementById('chart')||doc.getElementById('cryptoAnalysisToolsScript'))return;
    const tools=doc.createElement('script');
    tools.id='cryptoAnalysisToolsScript';
    tools.src='./chart-analysis-tools.js?v=7930free9';
    tools.onload=()=>{
      if(doc.getElementById('cryptoAnalysisHookScript'))return;
      const hook=doc.createElement('script');
      hook.id='cryptoAnalysisHookScript';
      hook.src='./chart-analysis-hook.js?v=7930free9';
      doc.body.appendChild(hook);
    };
    doc.body.appendChild(tools);
  }
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
    translate=function mergedTranslate(){baseTranslate();document.querySelector('#nav [data-route="market"]')?.remove()};
    document.getElementById('frame')?.addEventListener('load',()=>setTimeout(injectAnalyticsTools,0));
    translate();
  } catch (e) { console.warn('route merge skipped',e); }
})();