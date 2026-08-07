'use strict';
(() => {
  const BUILD='7930';
  const frame=document.getElementById('frame');
  if(!frame)return;
  function add(doc,id,source){if(doc.getElementById(id))return;const script=doc.createElement('script');script.id=id;script.src=`${source}?v=${BUILD}`;script.async=false;doc.head.appendChild(script);}
  frame.addEventListener('load',()=>{
    try{
      const doc=frame.contentDocument,path=frame.contentWindow.location.pathname;if(!doc)return;
      if(path.endsWith('/account.html')){
        add(doc,'sessionSecurityScript','./session-security.js');
      }
      if(path.endsWith('/admin.html')){
        add(doc,'adminCommercialScript','./admin-commercial.js');
        add(doc,'adminBillingEventsScript','./admin-billing-events.js');
        add(doc,'adminProviderReadinessScript','./admin-provider-readiness.js');
        add(doc,'adminAuditScript','./admin-audit.js');
        add(doc,'adminSessionSecurityScript','./admin-session-security.js');
        add(doc,'adminReadinessScript','./admin-readiness.js');
        add(doc,'adminIncidentLedgerScript','./admin-incidents.js');
        add(doc,'adminOperationalSloScript','./admin-slo.js');
        add(doc,'adminOperationalSummaryScript','./admin-ops-summary.js');
        add(doc,'adminDataIntegrityScript','./admin-integrity.js');
        add(doc,'adminReleaseDriftScript','./admin-drift.js');
        add(doc,'adminMaintenanceEvidenceScript','./admin-maintenance.js');
      }
    }catch(error){console.warn('Commercial integration unavailable',error);}
  });
})();