import { test, expect } from '@playwright/test';

const USER_ID='05f12cd4-0a2d-4ad8-aa5a-adbbe080a7f9';
const SESSION={access_token:'admin-test-access-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:USER_ID,email:'1specnazov1@gmail.com'}};
const SDK_STUB=`
(() => {
  const session=${JSON.stringify(SESSION)};
  const client={
    auth:{
      getSession:async()=>({data:{session},error:null}),
      refreshSession:async()=>({data:{session},error:null}),
      getUser:async token=>({data:{user:token===session.access_token?session.user:null},error:token===session.access_token?null:{message:'bad token'}}),
      signInWithPassword:async()=>({data:{session},error:null}),
      signOut:async()=>({error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    }
  };
  window.supabase={createClient:()=>client};
})();`;

test('existing CRYPTO LAB admin session is verified and opens dashboard',async({page})=>{
  let sawBearer=false;
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:SDK_STUB}));
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/rest/v1/rpc/get_crypto_admin_summary',async route=>{
    sawBearer=route.request().headers()['authorization']==='Bearer admin-test-access-token';
    return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({users_total:1,plans:{FREE:1,BASIC:0,PRO:0},pending_requests:[],recent_users:[{user_id:USER_ID,email:'1specnazov1@gmail.com',display_name:'Igor',role:'admin',plan:'FREE',status:'active'}]})});
  });
  await page.goto('/v79/admin.html?admin-session-smoke=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#login')).toBeHidden();
  await expect(page.locator('#users')).toHaveText('1');
  await expect(page.locator('#msg')).toContainText('Admin-доступ подтверждён');
  expect(sawBearer).toBe(true);
});
