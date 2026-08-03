'use strict';
(() => {
  const BUILD='7926';
  const frame=document.getElementById('frame');
  if(!frame)return;
  function add(doc,id,source){if(doc.getElementById(id))return;const script=doc.createElement('script');script.id=id;script.src=`${source}?v=${BUILD}`;script.async=false;doc.head.appendChild(script);}
  frame.addEventListener('load',()=>{
    try{
      const doc=frame.contentDocument,path=frame.contentWindow.location.pathname;if(!doc)return;
      if(path.endsWith('/account.html')){
        add(doc,'registrationConsentScript','./registration-consent.js');
        add(doc,'commercialCenterScript','./commercial.js');
        add(doc,'subscriptionLifecycleScript','./subscription-lifecycle.js');
      }
      if(path.endsWith('/admin.html')){
        add(doc,'adminCommercialScript','./admin-commercial.js');
        add(doc,'adminBillingEventsScript','./admin-billing-events.js');
      }
    }catch(error){console.warn('Commercial integration unavailable',error);}
  });
})();