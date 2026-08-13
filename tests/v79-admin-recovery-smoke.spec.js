import { test, expect } from '@playwright/test';

const SUPABASE_STUB = `
(() => {
  const client={
    auth:{
      getSession:async()=>({data:{session:null},error:null}),
      signInWithPassword:async()=>({data:{session:null},error:{message:'Invalid login credentials'}}),
      signOut:async()=>({error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    },
    rpc:async()=>({data:null,error:null})
  };
  window.supabase={createClient:()=>client};
})();`;

async function stub(page){
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB}));
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-recover',async route=>{
    if(route.request().method()==='GET'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,site_key:'test-site-key',captcha_action:'crypto_recover'})});
    }
    const body=JSON.parse(route.request().postData()||'{}');
    expect(body.email).toBe('1specnazov1@gmail.com');
    expect(body.captcha_token).toBe('test-turnstile-token');
    return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,status:'request_received'})});
  });
  await page.route('https://challenges.cloudflare.com/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.turnstile={render(_el,opts){setTimeout(()=>opts.callback('test-turnstile-token'),0);return 7},reset(){}};`}));
  return requests;
}

test('admin password recovery stays on CRYPTO LAB and uses the protected recovery endpoint',async({page})=>{
  const requests=await stub(page);
  await page.goto('/v79/admin.html?admin-recovery-smoke=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#resetPassword')).toBeVisible();
  await page.locator('#email').fill('1specnazov1@gmail.com');
  await page.locator('#resetPassword').click();
  await expect(page).toHaveURL(/\/v79\/recovery-request\.html\?email=1specnazov1%40gmail\.com&from=admin$/);
  await expect(page.locator('#email')).toHaveValue('1specnazov1@gmail.com');
  await expect(page.locator('#submit')).toBeEnabled();
  await page.locator('#submit').click();
  await expect(page.locator('#msg')).toContainText('Новое письмо отправлено');
  expect(requests.some(url=>url.includes('localhost:3000'))).toBe(false);
  expect(requests.some(url=>url.includes('/auth/v1/recover'))).toBe(false);
});
