import { test, expect } from '@playwright/test';

const ROUTES = ['home','market','analytics','scanner','ai','portfolio','calculator','backtest','journal','education','account','support'];
const BINANCE_KLINES=Array.from({length:120},(_,i)=>{const t=Date.UTC(2026,7,9,0,i),o=65000+i*2,c=o+(i%2?3:-2);return[t,String(o),String(Math.max(o,c)+8),String(Math.min(o,c)-8),String(c),String(12+i/10),t+59999]});
const BINANCE_TICKER={symbol:'BTCUSDT',lastPrice:'65123.45',priceChangePercent:'1.25',quoteVolume:'1450000000'};
const SUPABASE_STUB=`
(() => {
  const session={access_token:'audit-token',user:{id:'audit-owner',email:'audit-owner@example.invalid'}};let signedIn=true,callback=null;
  const account={effective_plan:'FREE',profile:{display_name:'Audit Owner',language:'ru',timezone:'Europe/Kyiv',role:'admin'},subscription:{status:'active',current_period_end:null},limits:{daily_ai_requests:25,daily_backtests:50,daily_scanner_views:-1,max_portfolio_assets:-1,max_favorites:-1},usage_today:{ai_requests:0,backtests:0,scanner_views:0},counts:{portfolio_assets:0,favorites:0}};
  const plans=[{plan:'FREE',display_order:1,daily_ai_requests:25,daily_backtests:50,daily_scanner_views:-1,max_portfolio_assets:-1,max_favorites:-1}];
  const chain=table=>{let op='select';const q={select(){op='select';return q},update(){op='update';return q},insert(){op='insert';return q},upsert(){op='upsert';return q},delete(){op='delete';return q},eq(){return q},neq(){return q},gt(){return q},gte(){return q},lt(){return q},lte(){return q},in(){return q},is(){return q},order(){return q},limit(){return q},range(){return q},maybeSingle(){return Promise.resolve({data:null,error:null})},single(){return Promise.resolve({data:null,error:null})},then(resolve,reject){const data=table==='crypto_plan_limits'?plans:[];return Promise.resolve({data:op==='select'?data:null,error:null}).then(resolve,reject)}};return q};
  const client={auth:{getSession:async()=>({data:{session:signedIn?session:null},error:null}),onAuthStateChange:cb=>{callback=cb;return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{signedIn=false;callback?.('SIGNED_OUT',null);return{error:null}},signInWithPassword:async()=>{signedIn=true;callback?.('SIGNED_IN',session);return{data:{session},error:null}},signUp:async()=>({data:{session:null},error:null}),resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null})},rpc:async name=>{if(name==='get_my_crypto_account')return{data:account,error:null};if(name==='get_crypto_feature_status')return{data:{allowed:true,remaining:25,limit:25},error:null};if(name==='get_my_crypto_support_tickets')return{data:[],error:null};if(name==='get_crypto_admin_summary')return{data:{users_total:1,plans:{FREE:1},pending_requests:[],recent_users:[]},error:null};return{data:{},error:null}},functions:{invoke:async(name,opts)=>{if(name==='crypto-lab-v79-scanner')return{data:{free_access:true,signals:[],shadow_candidates:[],latest_run:{dry_run:true,telegram_sent:0},access:{quota:{remaining:null,limit:-1}}},error:null};if(name==='crypto-lab-v79-support')return{data:{ok:true,tickets:[],counts:{open:0,in_progress:0,resolved:0,closed:0}},error:null};if(name==='crypto-lab-v79-access-admin')return{data:{ok:true,requests:[]},error:null};return{data:{},error:null}}},from:chain};
  window.supabase={createClient:()=>client};
})();`;
const TURNSTILE_STUB=`window.turnstile={render:(target,opts)=>{setTimeout(()=>opts?.callback?.('audit-turnstile-token'),0);return 1},reset(){},remove(){}};`;

async function stub(page){
  await page.route('https://**/*',async route=>{const url=route.request().url();
    if(url.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,latest_run:{finished_at:new Date().toISOString(),class_a_found:0,dry_run:true,telegram_sent:0},scanner_job:{active:true},signal_counts:{waiting:0,active:0,closed:0},signals:[],runs:[],server_time:new Date().toISOString()})});
    if(url.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'invite_only_free',request_access_enabled:true,free_access:true,invite_valid:false,site_key:null,captcha_action:'crypto_register',documents:[{key:'terms',version:'2026-08-03',url:'./terms.html'},{key:'privacy',version:'2026-08-03',url:'./privacy.html'},{key:'risk',version:'2026-08-03',url:'./risk-disclosure.html'}]})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,site_key:'audit-site-key',captcha_action:'crypto_recover',email_enumeration_safe:true})});
    if(url.includes('/functions/v1/crypto-lab-v79-commercial'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,mode:'invite_free',paid_features_enabled:false,code:'PAID_FEATURES_DISABLED'})});
    if(url.includes('api.binance.com'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    if(url.includes('data-api.binance.vision')){if(url.includes('/klines'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(BINANCE_KLINES)});if(url.includes('/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(BINANCE_TICKER)});return route.fulfill({status:404,body:'{}'});}
    if(url.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB});
    if(url.includes('challenges.cloudflare.com'))return route.fulfill({status:200,contentType:'application/javascript',body:TURNSTILE_STUB});
    return route.abort();
  });
}
async function noOverflow(page){const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,b:document.body.scrollWidth,h:document.documentElement.scrollWidth}));expect(Math.max(d.b,d.h)).toBeLessThanOrEqual(d.w+3)}

test('shell is fast, complete, responsive and contains every navigation target',async({page})=>{
  await stub(page);const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  const started=Date.now();await page.goto('/v79/app.html?full-audit=1',{waitUntil:'domcontentloaded'});expect(Date.now()-started).toBeLessThan(3000);
  await expect(page.locator('#homeView')).toBeVisible();await expect(page.locator('[data-home-tf]')).toHaveCount(8);await noOverflow(page);
  const actual=await page.locator('#nav button[data-route]').evaluateAll(nodes=>nodes.map(n=>n.dataset.route));expect(actual).toEqual(ROUTES);
  for(const tf of ['1m','5m','15m','1h','4h','1D','1W','1M']){await page.locator(`[data-home-tf="${tf}"]`).click();await expect(page.locator(`[data-home-tf="${tf}"]`)).toHaveClass(/on/)}
  expect(errors).toEqual([]);
});

test('every concrete module renders, has unique ids, named controls and no placeholders',async({page})=>{
  await stub(page);const files=['chart.html','scanner.html','ai.html','portfolio.html','calculator.html','backtest.html','journal.html','education.html','account.html','support.html','admin.html'];
  for(const file of files){
    await page.goto(`/v79/${file}?full-audit=1`,{waitUntil:'domcontentloaded'});await expect(page.locator('body')).toBeVisible();
    const bad=await page.locator('button,input,select,textarea').evaluateAll(nodes=>nodes.filter(n=>{if(n.disabled||n.type==='hidden')return false;const text=(n.textContent||'').trim();const named=n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')||n.getAttribute('title')||n.getAttribute('placeholder')||n.getAttribute('name')||n.id||(n.labels&&n.labels.length);return n.tagName==='BUTTON'?!text&&!named:!named}).map(n=>n.outerHTML.slice(0,180)));expect(bad,`${file} unnamed controls`).toEqual([]);
    const duplicates=await page.locator('[id]').evaluateAll(nodes=>{const seen=new Set(),dups=[];for(const n of nodes){if(seen.has(n.id))dups.push(n.id);seen.add(n.id)}return[...new Set(dups)]});expect(duplicates,`${file} duplicate ids`).toEqual([]);
    const text=await page.locator('body').innerText();expect(text).not.toContain('Модуль в разработке');
  }
});

test('FREE release contains no user-facing payment checkout controls',async({page})=>{
  await stub(page);await page.goto('/v79/account.html?full-audit=1',{waitUntil:'domcontentloaded'});await expect(page.locator('#accountView')).toBeVisible();const text=(await page.locator('body').innerText()).toLowerCase();expect(text).not.toContain('купить pro');expect(text).not.toContain('оплатить');expect(await page.locator('#friendsFamilyPilot,#commercialCenter').count()).toBe(0);
});
