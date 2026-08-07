import { test, expect } from '@playwright/test';

const ROUTES = [
  ['analytics', '#chart'],
  ['scanner', '#body'],
  ['ai', '#run'],
  ['portfolio', 'body'],
  ['journal', 'body'],
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

async function openShell(page){
  await stubExternalTraffic(page);
  await page.goto('/v79/app.html?owner-launch-smoke=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#homeView')).toBeVisible();
}

async function openModule(page,route,selector){
  await page.locator(`#nav button[data-route="${route}"]`).click();
  await expect(page.locator(`#nav button[data-route="${route}"]`)).toHaveClass(/on/);
  await expect(page.locator('#frameView')).toBeVisible();
  const module=page.frameLocator('#frame');
  await expect(module.locator('body')).toBeVisible();
  await expect(module.locator(selector)).toBeVisible();
  return module;
}

test('required owner launch route is responsive',async({page})=>{
  await openShell(page);
  for(const [route,selector] of ROUTES){
    const module=await openModule(page,route,selector);
    if(route==='account') await expect(module.locator('#adminPanelBtn')).toBeVisible();
  }
});

test('owner logout and repeated login remain responsive',async({page})=>{
  await openShell(page);
  let accountFrame=await openModule(page,'account','#accountView');
  await expect(accountFrame.locator('#adminPanelBtn')).toBeVisible();
  await accountFrame.locator('#logoutBtn').click();

  accountFrame=page.frameLocator('#frame');
  await expect(accountFrame.locator('#authView')).toBeVisible();
  await accountFrame.locator('#loginEmail').fill('owner-smoke@example.invalid');
  await accountFrame.locator('#loginPassword').fill('SmokeOnly123');
  await accountFrame.locator('#loginBtn').click();

  accountFrame=page.frameLocator('#frame');
  await expect(accountFrame.locator('#accountView')).toBeVisible();
  await expect(accountFrame.locator('#adminPanelBtn')).toBeVisible();
});
