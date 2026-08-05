'use strict';
(() => {
  const BUILD='7930';
  const load=(id,source)=>new Promise((resolve,reject)=>{
    if(document.getElementById(id)){resolve();return;}
    const script=document.createElement('script');
    script.id=id;
    script.src=`${source}?v=${BUILD}`;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Failed to load ${source}`));
    document.head.appendChild(script);
  });
  load('commercialCoreScript','./commercial-core.js')
    .then(()=>load('pricingOverlayScript','./pricing-overlay.js'))
    .catch(error=>console.warn('Commercial module loader unavailable',error));
})();
