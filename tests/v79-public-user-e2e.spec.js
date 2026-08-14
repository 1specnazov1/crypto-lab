import { test, expect } from '@playwright/test';

const SESSION={user:{id:'new-user-e2e',email:'new-user@example.invalid'},access_token:'new-user-token',refresh_token:'new-user-refresh',expires_at:4102444800};
const ACCOUNT={effective_plan:'FREE',profile:{display_name:'New User',language:'ru',timezone:'Europe/Kyiv',role:'user'},subscription:{status:'active',current_period_end:null},limits:{daily_ai_requests:25,daily_backtests:50,daily_scanner_views:-1,max_portfolio_assets:-1,max_favorites:-1},usage_today:{ai_requests:0,backtests:0,scanner_views:0},counts:{portfolio_assets:0,favorites:0}};
const DOCS=[{key:'terms',version:'2026-08-03',url:'./terms.html'},{key:'privacy',version:'2026-08-03',url:'./privacy.html'},{key:'risk',version:'2026-08-03',url:'./risk-disclosure.html'}];
const SDK=`(()=>{let signed=localStorage.getItem('crypto-e2e-auth')==='1',authCallback=null;const session=${JSON.stringify(SESSION)},account=${JSON.stringify(ACCOUNT)};const q={select(){return q},eq(){return q},order(){return q},limit(){return q},range(){return q},maybeSingle(){return Promise.resolve({data:null,error:null})},single(){return Promise.resolve({data:null,error:null})},then(r,j){return Promise.resolve({data:[],error:null}).then(r,j)}};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:signed?session:null},error:null}),refreshSession:async()=>({data:{session:signed?session:null},error:null}),getUser:async()=>({data:{user:signed?session.user:null},error:signed?null:{message:'No session'}}),onAuthStateChange:callback=>{authCallback=callback;return{data:{subscription:{unsubscribe(){authCallback=null}}}}},signInWithPassword:async()=>{signed=true;localStorage.setItem('crypto-e2e-auth','1');authCallback?.('SIGNED_IN',session);return{data:{session},error:null}},signOut:async()=>{signed=false;localStorage.removeItem('crypto-e2e-auth');authCallback?.('SIGNED_OUT',null);return{error:null}},updateUser:async()=>({error:null})},rpc:async name=>name==='get_my_crypto_account'?{data:account,error:null}:name==='get_crypto_feature_status'?{data:{allowed:true,remaining:25,limit:25},error:null}:{data:{},error:null},functions:{invoke:async()=>({data:{free_access:true,signals:[],shadow_candidates:[],latest_run:{dry_run:true,telegram_sent:0},access:{quota:{remaining:null,limit:-1}}},error:null})},from:()=>q})};})();`;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};

async function stub(page){
 await page.route('https://txhzxbizjpinowepfjkm.supabase.co/**',r=>r.fulfill({status:200,headers:CORS,contentType:'application/json',body:'{}'}));
 await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-recover**',async r=>{
  if(r.request().method()==='GET')return r.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,site_key:'test',captcha_action:'crypto_recover'})});
  return r.fulfill({status:202,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,status:'request_received'})});
 });
 await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-register**',async r=>{
  if(r.request().method()==='GET')return r.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,registration_mode:'invite_only_free',invite_valid:true,invite_email_masked:'n***@example.invalid',site_key:'test',captcha_action:'crypto_register',required_legal_keys:['terms','privacy','risk'],documents:DOCS})});
  const payload=JSON.parse(r.request().postData()||'{}');
  const accepted=Array.isArray(payload.legal_acceptances)?payload.legal_acceptances.map(x=>x.key).sort().join(','):'';
  if(accepted!=='privacy,risk,terms')return r.fulfill({status:409,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:false,error:'LEGAL_CONSENT_REQUIRED'})});
  return r.fulfill({status:202,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,status:'confirmation_sent'})});
 });
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',headers:CORS,body:SDK}));
 await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',headers:CORS,body:`window.turnstile={render(_e,o){setTimeout(()=>o.callback('e2e-captcha'),0);return 1},reset(){}};`}));
 await page.route('https://api.binance.com/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.route('https://data-api.binance.vision/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
}

test('new invited user can register, login, use core modules, recover and relogin',async({page})=>{
 await stub(page);
 await page.goto('/v79/account.html?invite=e2e-invite-token',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#signupTab')).toBeEnabled();
 await page.locator('#signupTab').click();
 await page.locator('#signupName').fill('New User');
 await page.locator('#signupPassword').fill('StrongPass123');
 const legal=page.locator('[data-registration-legal]');
 await expect(legal).toHaveCount(3);
 for(let i=0;i<3;i++)await legal.nth(i).check();
 await expect(page.locator('#signupBtn')).toBeEnabled();
 await page.locator('#signupBtn').click();
 await expect(page.locator('#message')).toContainText(/подтверж|confirm|confirmation/i);

 await page.locator('#loginTab').click();
 await page.locator('#loginEmail').fill('new-user@example.invalid');
 await page.locator('#loginPassword').fill('StrongPass123');
 await page.locator('#loginBtn').click();
 await expect(page.locator('#accountView')).toBeVisible();
 await expect(page.locator('#planBadge')).toContainText('FREE');

 for(const [file,selector] of [['scanner.html','#body'],['ai.html','#run'],['portfolio.html','#totalValue'],['backtest.html','#run']]){
  await page.goto(`/v79/${file}?public-e2e=1`,{waitUntil:'domcontentloaded'});
  await expect(page.locator(selector)).toBeVisible();
 }

 await page.goto('/v79/recovery-request.html?email=new-user%40example.invalid',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#submit')).toBeEnabled();
 await page.locator('#submit').click();
 await expect(page.locator('#msg')).toContainText(/письмо отправлено/i);

 await page.goto('/v79/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#accountView')).toBeVisible();
 await page.locator('#logoutBtn').click();
 await expect(page.locator('#authView')).toBeVisible();
 await page.locator('#loginEmail').fill('new-user@example.invalid');
 await page.locator('#loginPassword').fill('StrongPass123');
 await page.locator('#loginBtn').click();
 await expect(page.locator('#accountView')).toBeVisible();
});
