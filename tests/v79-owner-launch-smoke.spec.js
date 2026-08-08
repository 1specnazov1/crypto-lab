import { test } from '@playwright/test';

const ROUTES = [
  ['analytics', 'chart.html', '#chart'],
  ['scanner', 'scanner.html', '#body'],
  ['ai', 'ai.html', '#run'],
  ['portfolio', 'portfolio.html', '#totalValue'],
  ['backtest', 'backtest.html', '#run'],
  ['journal', 'journal.html', '#tradeForm'],
  ['account', 'account.html', '#accountView']
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
    limits: { daily_ai_requests: 25, daily_backtests: 50, daily_scanner_views: -1, max_portfolio_assets: -1, max_favorites: -1 },
    usage_today: { ai_requests: 0, backtests: 0, scanner_views: 0 },
    counts: { portfolio_assets: 0, favorites: 0 }
  };
  const adminSummary = {
    users_total: 1,
    plans: { FREE: 1, BASIC: 0, PRO: 0 },
    pending_requests: [],
    recent_users: [{ user_id: 'owner-smoke', email: 'owner-smoke@example.invalid', display_name: 'Owner Smoke', role: 'admin', plan: 'FREE', status: 'active' }]
  };
  const plans = [
    { plan: 'FREE', display_order: 1, daily_ai_requests: 25, daily_backtests: 50, daily_scanner_views: -1, max_portfolio_assets: -1, max_favorites: -1 },
    { plan: 'BASIC', display_order: 2, daily_ai_requests: 30, daily_backtests: 20, daily_scanner_views: 100, max_portfolio_assets: 50, max_favorites: 100 },
    { plan: 'PRO', display_order: 3, daily_ai_requests: 150, daily_backtests: 100, daily_scanner_views: -1, max_portfolio_assets: -1, max_favorites: -1 }
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
      if(name==='get_crypto_feature_status') return {data:{allowed:true,remaining:25,limit:25},error:null};
      if(name==='get_my_crypto_support_tickets') return {data:[],error:null};
      if(name==='get_crypto_admin_summary') return {data:adminSummary,error:null};
      if(name==='admin_set_crypto_subscription') return {data:{plan:'FREE'},error:null};
      return {data:{},error:null};
    },
    functions: { invoke: async name => name==='crypto-lab-v79-scanner'
      ? {data:{free_access:true,signals:[],shadow_candidates:[],latest_run:{dry_run:true,telegram_sent:0},access:{quota:{remaining:null,limit:-1}}},error:null}
      : {data:{},error:null} },
    from: chain
  };
  window.supabase={createClient:()=>client};
})();`;

async function stubExternalTraffic(page) {
  await page.route('https://**/*', async route => {
    const url=route.request().url();
    if(url.includes('/functions/v1/crypto-lab-v79-preview')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,latest_run:null,latest_monitor:null,active_signals:[],runs:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-commercial')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,mode:'public_free',paid_features_enabled:false,code:'PAID_FEATURES_DISABLED'})});
    if(url.includes('/functions/v1/crypto-lab-v79-register')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,registration_mode:'public_free',free_access:true,site_key:'turnstile-public-test',captcha_provider:'turnstile',captcha_action:'crypto_register',password_min_length:10,required_legal_keys:['terms','privacy','risk'],documents:[{key:'terms',version:'2026-08-03',url:'./terms.html'},{key:'privacy',version:'2026-08-03',url:'./privacy.html'},{key:'risk',version:'2026-08-03',url:'./risk-disclosure.html'}],readiness:{feature_flag:true,portal:true,turnstile:true,mail_provider:true,mail_provider_code:'resend',legal_documents:true}})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,free_access:true,site_key:'turnstile-public-test',captcha_provider:'turnstile',captcha_action:'crypto_recover',email_enumeration_safe:true,readiness:{feature_flag:true,turnstile:true,mail_provider:true,mail_provider_code:'resend'}})});
    if(url.includes('api.binance.com')||url.includes('data-api.binance.vision')) return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    if(url.includes('cdn.jsdelivr.net')) return route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB});
    return route.abort();
  });
}

async function poll(page,probe,expected,label,timeout=8000){
  const deadline=Date.now()+timeout;let last='';
  while(Date.now()<deadline){last=await page.evaluate(probe);if(last===expected)return;await page.waitForTimeout(100);}
  throw new Error(`${label}: expected ${expected}, got ${last}`);
}

test('shell routes target every required owner module',async({request})=>{
  const [appResponse,extensionResponse]=await Promise.all([request.get('/v79/app.js'),request.get('/v79/app-extension.js')]);
  if(!appResponse.ok()||!extensionResponse.ok())throw new Error('Shell route sources unavailable');
  const app=await appResponse.text(),extension=await extensionResponse.text();
  const contracts={analytics:[app,"return './chart.html?'"],scanner:[extension,"if (route === 'scanner') return './scanner.html?'"],ai:[extension,"if (route === 'ai') return './ai.html?'"],portfolio:[app,"if(route==='portfolio')return './portfolio.html?'"],backtest:[extension,"if (route === 'backtest') return './backtest.html?'"],journal:[extension,"return './journal.html?' + params"],account:[extension,"if (route === 'account') return './account.html?'"]};
  for(const [route,file] of ROUTES){const [source,marker]=contracts[route];if(!source.includes(marker)||!source.includes(file))throw new Error(`${route} shell route contract missing`);}
});

test('required owner modules render their functional DOM',async({page})=>{
  await stubExternalTraffic(page);
  for(const [route,file,selector] of ROUTES){await page.goto(`/v79/${file}?owner-launch-smoke=1`,{waitUntil:'domcontentloaded'});const deadline=Date.now()+8000;let last='';while(Date.now()<deadline){last=await page.evaluate(({routeName,selector})=>{const node=document.querySelector(selector);if(!node)return 'missing';if(routeName==='account')return !node.classList.contains('hide')&&!!document.getElementById('adminPanelBtn')?'ready':'waiting';return 'ready';},{routeName:route,selector});if(last==='ready')break;await page.waitForTimeout(100);}if(last!=='ready')throw new Error(`${route} direct module: ${last}`);}
});

test('admin dashboard renders for owner admin session',async({page})=>{
  await stubExternalTraffic(page);await page.goto('/v79/admin.html?owner-launch-smoke=1',{waitUntil:'domcontentloaded'});
  await poll(page,()=>{const dashboard=document.getElementById('dashboard'),login=document.getElementById('login'),users=document.getElementById('users');return dashboard&&!dashboard.classList.contains('hide')&&login?.classList.contains('hide')&&users?.textContent==='1'?'admin-ready':'waiting';},'admin-ready','admin dashboard');
});

test('public free account hides paid plans and shows fair-use access',async({page})=>{
  await stubExternalTraffic(page);await page.goto('/v79/account.html?public-free-smoke=1',{waitUntil:'domcontentloaded'});
  await poll(page,()=>{const account=document.getElementById('accountView'),plans=document.getElementById('plans'),badge=document.getElementById('planBadge'),period=document.getElementById('periodEnd'),why=document.getElementById('whyText')?.textContent||'';if(!account||account.classList.contains('hide'))return 'waiting';const paymentAbsent=!document.getElementById('friendsFamilyPilot')&&!document.getElementById('commercialCenter');return plans?.style.display==='none'&&badge?.textContent==='FREE'&&period?.textContent==='Бесплатно'&&why.includes('бесплатно')&&paymentAbsent?'free-ready':'waiting';},'free-ready','public free account');
});

test('owner logout and repeated login remain responsive',async({page})=>{
  await stubExternalTraffic(page);await page.goto('/v79/account.html?owner-launch-smoke=1',{waitUntil:'domcontentloaded'});
  await poll(page,()=>{const account=document.getElementById('accountView');return account&&!account.classList.contains('hide')&&document.getElementById('adminPanelBtn')?'owner-ready':'waiting';},'owner-ready','initial owner account');
  const logout=await page.evaluate(()=>{const button=document.getElementById('logoutBtn');if(!button)return 'missing';button.click();return 'clicked';});if(logout!=='clicked')throw new Error(`logout button: ${logout}`);
  await poll(page,()=>{const auth=document.getElementById('authView');return auth&&!auth.classList.contains('hide')?'logged-out':'waiting';},'logged-out','logout');
  const login=await page.evaluate(()=>{const email=document.getElementById('loginEmail'),password=document.getElementById('loginPassword'),button=document.getElementById('loginBtn');if(!email||!password||!button)return 'missing';email.value='owner-smoke@example.invalid';password.value='SmokeOnly123';button.click();return 'clicked';});if(login!=='clicked')throw new Error(`login button: ${login}`);
  await poll(page,()=>{const account=document.getElementById('accountView');return account&&!account.classList.contains('hide')&&document.getElementById('adminPanelBtn')?'relogin-ready':'waiting';},'relogin-ready','re-login');
});
