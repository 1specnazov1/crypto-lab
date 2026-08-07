'use strict';
const CACHE='crypto-lab-v79-7930-pwa3';
const SHELL=['./','./index.html','./app.html','./app.css','./app.js','./app-extension.js','./support-extension.js','./commercial-extension.js','./accessibility.js','./module-accessibility.js','./platform.css','./module-mobile.css','./manifest.webmanifest','./icon.svg','./offline.html','./chart.html','./portfolio.html','./calculator.html','./backtest.html','./backtest-history.js','./scanner.html','./scanner-actions.js','./ai.html','./journal.html','./journal.js','./journal-import.js','./journal-analytics.js','./account.html','./account-actions.js','./session-security.js','./registration-consent.js','./support.html','./admin.html','./admin-health.js','./admin-incidents.js','./admin-slo.js','./admin-ops-summary.js','./admin-integrity.js','./admin-drift.js','./admin-maintenance.js','./admin-deletions.js','./admin-support.js','./admin-commercial.js','./admin-billing-events.js','./admin-provider-readiness.js','./admin-audit.js','./admin-session-security.js','./admin-readiness.js','./admin-telemetry.js','./admin-ai-telemetry.js','./legal.js','./privacy.html','./terms.html','./risk-disclosure.html','./refund.html'];
const AUTH_NETWORK_FIRST=new Set(['account.html','account-actions.js','registration-consent.js','app-extension.js','commercial-extension.js']);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('crypto-lab-v79-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='CLEAR_OLD_CACHES')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))))});
function isApi(url){return url.hostname.includes('supabase.co')||url.hostname.includes('binance.com')||url.hostname.includes('binance.vision')||url.hostname.includes('jsdelivr.net')||url.hostname.includes('challenges.cloudflare.com')}
function authNetworkFirst(url){return AUTH_NETWORK_FIRST.has(url.pathname.split('/').pop()||'')}
async function cached(request){return caches.match(request,{ignoreSearch:true})}
async function store(request,response){if(response?.ok){const copy=response.clone();await caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(isApi(url)||url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(response=>store(req,response)).catch(async()=>{
      const hit=await cached(req);if(hit)return hit;
      if(url.pathname.endsWith('/v79/')||url.pathname.endsWith('/v79/index.html')||url.pathname.endsWith('/v79/app.html')){
        const shell=await caches.match('./app.html',{ignoreSearch:true});if(shell)return shell;
      }
      return caches.match('./offline.html',{ignoreSearch:true});
    }));return;
  }
  if(authNetworkFirst(url)){
    event.respondWith(fetch(req).then(response=>store(req,response)).catch(()=>cached(req).then(hit=>hit||caches.match('./offline.html',{ignoreSearch:true}))));return;
  }
  event.respondWith(cached(req).then(hit=>hit||fetch(req).then(response=>store(req,response)).catch(()=>caches.match('./offline.html',{ignoreSearch:true}))));
});