import { test, expect } from '@playwright/test';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const DEVICE='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SESSION={user:{id:'email-access-user',email:'email-access@example.invalid'},access_token:'email-access-jwt',refresh_token:'email-access-refresh',expires_at:4102444800};
const SDK=`(()=>{const session=${JSON.stringify(SESSION)};window.supabase={createClient:()=>({auth:{verifyOtp:async({token_hash,type})=>{if(token_hash!=='server-hashed-token'||type!=='email')return{data:{session:null},error:{message:'bad otp'}};localStorage.setItem('sb-txhzxbizjpinowepfjkm-auth-token',JSON.stringify(session));return{data:{session},error:null}}}})}})();`;

async function stubSdk(page){
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,headers:CORS,contentType:'application/javascript',body:SDK}));
}

test('forwarded email access link is rejected when browser secret is absent',async({page})=>{
  await stubSdk(page);
  let apiCalls=0;
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-access',r=>{apiCalls++;return r.fulfill({status:500,headers:CORS,contentType:'application/json',body:'{}'})});
  await page.goto('/v79/access-verify.html#t=forwarded-token-abcdefghijklmnopqrstuvwxyz',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#state')).toContainText(/браузер не запрашивал доступ|пересланная ссылка/i);
  await expect(page.locator('#state')).toHaveClass(/bad/);
  await expect(page.locator('#retry')).toBeVisible();
  await expect.poll(()=>apiCalls).toBe(0);
  await expect(page).not.toHaveURL(/#t=/);
});

test('requesting browser redeems once, creates session, claims grant and enters app',async({page})=>{
  await stubSdk(page);
  await page.addInitScript(({device})=>localStorage.setItem('cryptoLabEmailAccessDeviceV1',device),{device:DEVICE});
  let redeemPayload=null,claimPayload=null,claimAuth='';
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-access',async r=>{
    const req=r.request();
    if(req.method()==='GET')return r.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,mode:'email_bound',request_enabled:true,site_key:'test',captcha_action:'crypto_access_request',documents:[]})});
    const body=JSON.parse(req.postData()||'{}');
    if(body.action==='redeem'){
      redeemPayload=body;
      return r.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,status:'verified_device',grant_id:'11111111-1111-4111-8111-111111111111',token_hash:'server-hashed-token',email_masked:'em****@example.invalid'})});
    }
    if(body.action==='claim'){
      claimPayload=body;claimAuth=req.headers()['authorization']||'';
      return r.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,status:'activated'})});
    }
    return r.fulfill({status:400,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:false})});
  });
  await page.route('https://api.binance.com/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.route('https://data-api.binance.vision/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/v79/access-verify.html#t=request-browser-token-abcdefghijklmnopqrstuvwxyz',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/v79\/app\.html$/, {timeout:8000});
  expect(redeemPayload?.device_secret).toBe(DEVICE);
  expect(redeemPayload?.token).toBe('request-browser-token-abcdefghijklmnopqrstuvwxyz');
  expect(claimPayload?.grant_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(claimAuth).toBe('Bearer email-access-jwt');
  const stored=await page.evaluate(()=>localStorage.getItem('cryptoLabEmailAccessDeviceV1'));
  expect(stored).toBeNull();
});
