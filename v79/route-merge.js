'use strict';
(() => {
  function injectAnalyticsTools(){
    const frame=document.getElementById('frame');
    if(!frame)return;
    let doc;
    try{doc=frame.contentDocument}catch{return}
    if(!doc||!doc.getElementById('chart')||doc.getElementById('cryptoAnalysisToolsScript'))return;
    if(!doc.getElementById('cryptoChartLivePriceScript')){
      const live=doc.createElement('script');
      live.id='cryptoChartLivePriceScript';
      live.src='./chart-live-price.js?v=7930free23';
      doc.body.appendChild(live);
    }
    const tools=doc.createElement('script');
    tools.id='cryptoAnalysisToolsScript';
    tools.src='./chart-analysis-tools.js?v=7930free11';
    tools.onload=()=>{
      if(doc.getElementById('cryptoChartVisualUpgradesScript'))return;
      const visual=doc.createElement('script');
      visual.id='cryptoChartVisualUpgradesScript';
      visual.src='./chart-visual-upgrades.js?v=7930free23';
      visual.onload=()=>{
        const scale=doc.createElement('script');
        scale.id='cryptoChartFibScaleScript';
        scale.src='./chart-fib-scale.js?v=7930free19';
        scale.onload=()=>{
          if(doc.getElementById('cryptoAnalysisHookScript'))return;
          const hook=doc.createElement('script');
          hook.id='cryptoAnalysisHookScript';
          hook.src='./chart-analysis-hook.js?v=7930free19';
          hook.onload=()=>{
            if(doc.getElementById('cryptoOnchainScript'))return;
            const onchain=doc.createElement('script');
            onchain.id='cryptoOnchainScript';
            onchain.src='./chart-onchain.js?v=7930free14';
            doc.body.appendChild(onchain);
          };
          doc.body.appendChild(hook);
        };
        doc.body.appendChild(scale);
      };
      doc.body.appendChild(visual);
    };
    doc.body.appendChild(tools);
  }
  function loadNewsExtension(){
    if(document.getElementById('cryptoNewsExtensionScript'))return;
    const script=document.createElement('script');
    script.id='cryptoNewsExtensionScript';
    script.src='./news-extension.js?v=7930free22';
    script.onload=()=>{
      if(document.getElementById('cryptoNewsTickerControlsScript'))return;
      const controls=document.createElement('script');
      controls.id='cryptoNewsTickerControlsScript';
      controls.src='./news-ticker-controls.js?v=7930free23';
      document.body.appendChild(controls);
    };
    document.body.appendChild(script);
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
    loadNewsExtension();
  } catch (e) { console.warn('route merge skipped',e); }
})();