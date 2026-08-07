import { test } from '@playwright/test';

const ROUTES = [
  ['analytics', '#chart'],
  ['scanner', '#body'],
  ['ai', '#run'],
  ['portfolio', '#totalValue'],
  ['journal', '#tradeForm'],
  ['account', '#accountView']
];

const SUPABASE_STUB = `
(() => {
  const ownerSession = { user: { id: 'owner-smoke', email: 'owner-smoke@example.invalid' } };
  let signedIn = true;
  let authCallback = null;
  const account = {
    effective_plan: 'FREE',
    profile: { display_name: 'Owner Smoke', language: 'ru', timezone: 'Europe/Kyiv', role: 'admin' },
    subscription: { status: 'active', current_period_end: null },
    limits: { daily_ai_requests: 3, daily_backtests: 3, daily_scanner_views: 10, max_portfolio_assets: 5, max_favorites: 10 },
    usage_today: { ai_requests: 0, backtests: 0, scanner_views: 0 },
    counts: { portfolio_assets: 0, favorites: 0 }
  };
  const plans = [
    { plan: 'FREE', display_order: 1, daily_ai_requests: 3, daily_backtests: 3, max_portfolio_assets: 5, max_favorites: 10 },
    { plan: 'BASIC', display_order: 2, daily_ai_requests: 30, daily_backtests: 20, max_portfolio_assets: 50, max_favorites: 100 },
    { plan: 'PRO', display_order: 3, daily_ai_requests: -1, daily_backtests: -1, max_portfolio_assets: -1, max_favorites: -1 }
  ];
  const queryResult = (table, single = false) => ({ data: table === 'crypto_plan_limits' ? plans : (single ? null : []), error: null });
  const chain = (table) => {
    let operation = 'select';
    const q = {
      select() { operation='select'; return q; }, update() { operation='update'; return q; }, insert() { operation='insert'; return q; },
      upsert() { operation='upsert'; return q; }, delete() { operation='delete'; return q; },
      eq() { return q; }, neq() { return q; }, gt() { return q; }, gte() { return q; }, lt() { return q; }, lte() { return q; },
      in() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; }, range() { return q; },
      maybeSingle() { return Promise.resolve(queryResult(table, true)); },
      single() { return Promise.resolve(queryResult(table, true)); },
      then(resolve,reject) { return Promise.resolve(operation==='select' ? queryResult(table) : {data:null,error:null}).then(resolve,reject); }
    };
    return q;
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? ownerSession : null }, error: null }),
      onAuthStateChange: callback => { authCallback=callback; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => { signedIn=false; authCallback?.('SIGNED_OUT',null); return {error:null}; },
      signInWithPassword: async () => { signedIn=true; authCallback?.('SIGNED_IN',ownerSession); return {data:{session:ownerSession},error:null}; },
      signUp: async () => ({data:{session:null},error:null}),
      resetPasswordForEmail: async () => ({error:null}),
      updateUser: async () => ({error:null})
    },
    rpc: async name => {
      if(name==='get_my_crypto_account') return {data:account,error:null};
      if(name==='get_crypto_feature_status') return {data:{allowed:true,remaining:3,limit:3},error:null};
      if(name==='get_my_crypto_support_tickets') return {data:[],error:null};
      return {data:{},error:null};
    },
    functions: { invoke: async name => name==='crypto-lab-v79-scanner'
      ? {data:{signals:[],latest_run:{},access:{quota:{remaining:10,limit:10}}},error:null}
      : {data:{},error:null} },
    from: chain
  };
  window.supabase={createClient:()=>client};
})();`;

async function stubExternalTraffic(page) {
  await page.route('https://**/*', async route => {
    const url=route.request().url();
    if(url.includes('/functions/v1/crypto-lab-v79-preview')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,latest_run:null,latest_monitor:null,active_signals:[],runs:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-register')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'disabled',site_key:null,captcha_provider:'turnstile',captcha_action:'crypto_register',password_min_length:10,required_legal_keys:['terms','privacy','refund','risk'],documents:[{key:'terms',version:'2026-08-03',url:'./terms.html'},{key:'privacy',version:'2026-08-03',url:'./privacy.html'},{key:'refund',version:'2026-08-07-v1',url:'./refund.html'},{key:'risk',version:'2026-08-03',url:'./risk-disclosure.html'}],readiness:{feature_flag:false,owner_bootstrap:false,turnstile:true,mail_provider:true,mail_provider_code:'resend',legal_documents:true}})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,site_key:null,captcha_provider:'turnstile',captcha_action:'crypto_recover',email_enumeration_safe:true,readiness:{feature_flag:false,turnstile:true,mail_provider:true,mail_provider_code:'resend'}})});
    if(url.includes('api.binance.com')||url.includes('data-api.binance.vision')) return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    if(url.includes('cdn.jsdelivr.net')) return route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB});
    return route.abort();
  });
}

async function waitPrimitive(page, probe, expected, label, timeout=8000){
  const deadline=Date.now()+timeout;
  let last='';
  while(Date.now()<deadline){
    last=await page.evaluate(probe);
    if(last===expected)return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label}: expected ${expected}, got ${last}`);
}

async function openShell(page){
  await stubExternalTraffic(page);
  await page.goto('/v79/app.html?owner-launch-smoke=1',{waitUntil:'domcontentloaded'});
  await waitPrimitive(page,()=>{
    const home=document.getElementById('homeView');
    return home&&!home.classList.contains('hide')?'home-ready':'not-ready';
  },'home-ready','dashboard');
}

async function openModule(page,route,selector){
  await page.evaluate(routeName=>document.querySelector(`#nav button[data-route="${routeName}"]`)?.click(),route);
  const expected='1|1|1|1';
  const deadline=Date.now()+8000;
  let last='';
  while(Date.now()<deadline){
    last=await page.evaluate(({routeName,selector})=>{
      const button=document.querySelector(`#nav button[data-route="${routeName}"]`);
      const frameView=document.getElementById('frameView');
      const frame=document.getElementById('frame');
      const doc=frame?.contentDocument;
      const routeOn=!!button?.classList.contains('on');
      const frameVisible=!!frameView&&!frameView.classList.contains('hide');
      const bodyReady=!!doc?.body;
      let moduleReady=false;
      if(doc){
        const node=selector==='body'?doc.body:doc.querySelector(selector);
        moduleReady=!!node;
        if(routeName==='account'&&node)moduleReady=!node.classList.contains('hide')&&!!doc.getElementById('adminPanelBtn');
      }
      return [routeOn,frameVisible,bodyReady,moduleReady].map(Boolean).map(v=>v?'1':'0').join('|');
    },{routeName:route,selector});
    if(last===expected)return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${route} module: expected ${expected}, got ${last}`);
}

test('required owner launch route is responsive',async({page})=>{
  await openShell(page);
  for(const [route,selector] of ROUTES)await openModule(page,route,selector);
});

test('owner logout and repeated login remain responsive',async({page})=>{
  await openShell(page);
  await openModule(page,'account','#accountView');

  const logoutClicked=await page.evaluate(()=>{
    const doc=document.getElementById('frame')?.contentDocument;
    const button=doc?.getElementById('logoutBtn');
    if(!button)return 'missing';
    button.click();return 'clicked';
  });
  if(logoutClicked!=='clicked')throw new Error(`logout: ${logoutClicked}`);

  await waitPrimitive(page,()=>{
    const doc=document.getElementById('frame')?.contentDocument;
    const auth=doc?.getElementById('authView');
    return auth&&!auth.classList.contains('hide')?'logged-out':'waiting';
  },'logged-out','logout state');

  const loginClicked=await page.evaluate(()=>{
    const doc=document.getElementById('frame')?.contentDocument;
    const email=doc?.getElementById('loginEmail'),password=doc?.getElementById('loginPassword'),button=doc?.getElementById('loginBtn');
    if(!email||!password||!button)return 'missing';
    email.value='owner-smoke@example.invalid';
    password.value='SmokeOnly123';
    email.dispatchEvent(new Event('input',{bubbles:true}));
    password.dispatchEvent(new Event('input',{bubbles:true}));
    button.click();return 'clicked';
  });
  if(loginClicked!=='clicked')throw new Error(`login: ${loginClicked}`);

  await waitPrimitive(page,()=>{
    const doc=document.getElementById('frame')?.contentDocument;
    const account=doc?.getElementById('accountView'),admin=doc?.getElementById('adminPanelBtn');
    return account&&!account.classList.contains('hide')&&admin?'logged-in-admin':'waiting';
  },'logged-in-admin','re-login state');
});
