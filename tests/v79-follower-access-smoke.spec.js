import { test, expect } from '@playwright/test';

const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-x-auth-check';
const AUTH_KEY='sb-txhzxbizjpinowepfjkm-auth-token';

async function quietExternal(page){
  await page.route('https://**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(ENDPOINT))return route.fallback();
    if(url.includes('/auth/v1/token?grant_type=refresh_token'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'fresh-follower-token',refresh_token:'fresh-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer'})});
    if(url.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:`window.supabase={createClient(){return {functions:{invoke:async()=>({data:{ok:true},error:null})}}}};`});
    if(url.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,server_time:new Date().toISOString(),latest_run:null,signal_counts:{},scanner_job:{active:false},monitor_job:{active:false},signals:[],runs:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-access'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,mode:'email_bound',request_enabled:true,site_key:'access-smoke',captcha_action:'crypto_access_request',documents:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'x_follower_free',documents:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false})});
    if(url.includes('api.binance.com')||url.includes('data-api.binance.vision'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.abort();
  });
}

test('first launch defaults to English and exposes the exact FREE package',async({page})=>{
  await page.addInitScript(()=>localStorage.clear());
  await quietExternal(page);
  await page.goto('/v79/app.html?english-first-smoke=1&access-gate-smoke=1',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('cryptoLabLanguage'))).toBe('en');
  await expect(page.locator('#lang')).toHaveValue('en');
  const info=page.locator('#freeLaunchInfo');
  await expect(info).toContainText('FREE — for verified @CryptoLabPulse followers');
  await expect(info).toContainText('Chart & Analytics');
  await expect(info).toContainText('100 opens / day');
  await expect(info).toContainText('AI Analysis');
  await expect(info).toContainText('5 analyses / day');
  await expect(info).toContainText('Scanner EXACT Replay');
  await expect(info).toContainText('25 runs / day');
  await expect(info).toContainText('Suggest an improvement');
  await expect(page.locator('#accessGateSignup')).toHaveText('Create FREE account');
  await page.locator('#accessGateSignup').click();
  await expect(page).toHaveURL(/\/v79\/account\.html\?signup=1$/);
});

test('signed-in non-verified user is blocked behind X follower verification',async({page})=>{
  await page.addInitScript(key=>{localStorage.clear();localStorage.setItem(key,JSON.stringify({access_token:'follower-smoke-token'}));},AUTH_KEY);
  await quietExternal(page);
  await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,allowed:false,code:'X_NOT_CONNECTED',connect_required:true,target_handle:'@CryptoLabPulse'})}));
  await page.goto('/v79/feedback.html?follower-gate-smoke=1',{waitUntil:'domcontentloaded'});
  const gate=page.locator('#cryptoFollowerGuard');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('Follower access required');
  await expect(gate).toContainText('verified followers of @CryptoLabPulse');
  await expect(gate.locator('#xfgVerify')).toHaveText('Connect X & verify');
});

test('server-verified X follower passes the launch gate',async({page})=>{
  await page.addInitScript(key=>{localStorage.clear();localStorage.setItem(key,JSON.stringify({access_token:'follower-smoke-token'}));},AUTH_KEY);
  await quietExternal(page);
  await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,allowed:true,code:'FOLLOWER_VERIFIED',x_username:'verified_follower',target_handle:'@CryptoLabPulse',verified_at:new Date().toISOString()})}));
  await page.goto('/v79/feedback.html?follower-gate-smoke=1',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.locator('#cryptoFollowerGuard').count()).toBe(0);
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.xFollowerAccess||'')).toBe('verified');
});

test('expired Supabase access token refreshes before follower verification',async({page})=>{
  await page.addInitScript(key=>{
    localStorage.clear();
    localStorage.setItem(key,JSON.stringify({access_token:'expired-follower-token',refresh_token:'valid-refresh-token',expires_at:Math.floor(Date.now()/1000)-60,token_type:'bearer'}));
  },AUTH_KEY);
  await quietExternal(page);
  await page.route(ENDPOINT,async route=>{
    const auth=route.request().headers()['authorization']||'';
    if(auth!=='Bearer fresh-follower-token')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:'Authentication required'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,allowed:true,code:'FOLLOWER_VERIFIED',x_username:'CryptoLabPulse',target_handle:'@CryptoLabPulse',bypass:'admin'})});
  });
  await page.goto('/v79/feedback.html?follower-gate-smoke=1',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}').access_token,AUTH_KEY)).toBe('fresh-follower-token');
  await expect.poll(()=>page.locator('#cryptoFollowerGuard').count()).toBe(0);
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.xFollowerAccess||'')).toBe('verified');
});
