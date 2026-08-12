import { test, expect } from '@playwright/test';

const SUPABASE_STUB=`
(() => {
  const session={access_token:'backtest-smoke-token',user:{id:'backtest-smoke',email:'backtest@example.invalid'}};
  const chain=()=>{const q={select(){return q},order(){return q},limit(){return q},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q};
  const client={
    auth:{
      getSession:async()=>({data:{session},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      signOut:async()=>({error:null})
    },
    rpc:async(name)=>{
      if(name==='get_crypto_feature_status')return await new Promise(()=>{});
      return {data:{},error:null};
    },
    from:chain
  };
  window.supabase={createClient:()=>client};
})();`;

async function stub(page){
  await page.route('https://**/*',async route=>{
    const url=route.request().url();
    if(url.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB});
    if(url.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,latest_run:null,scanner_job:{active:true},signal_counts:{},signals:[],runs:[],server_time:new Date().toISOString()})});
    if(url.includes('/functions/v1/crypto-lab-v79-news'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,breaking:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-backtest-run')){
      const result={
        engineVersion:1,capital:10000,equity:10125,net:125,returnPct:1.25,maxDrawdown:0.4,start:Date.now()-86400000,end:Date.now(),
        all:{count:2,wins:1,losses:1,winRate:50,profitFactor:1.4,pnl:125,averageR:.3},
        long:{count:1,wins:1,losses:0,winRate:100,profitFactor:null,pnl:175,averageR:1.2},
        short:{count:1,wins:0,losses:1,winRate:0,profitFactor:0,pnl:-50,averageR:-.6},
        trades:[],curve:[{time:Date.now()-86400000,value:10000},{time:Date.now(),value:10125}]
      };
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,quota:{limit:50,remaining:49},result})});
    }
    if(url.includes('api.binance.com/api/v3/exchangeInfo'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:[]})});
    if(url.includes('data-api.binance.vision')||url.includes('api.binance.com'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.abort();
  });
}

test('server backtest Run remains clickable when client quota preview hangs',async({page})=>{
  await stub(page);
  await page.goto('/v79/app.html?route=backtest',{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('#frame');
  await expect(frame.locator('#run')).toBeVisible({timeout:8000});
  await expect(frame.locator('#backtestRunGuardScript')).toHaveCount(1,{timeout:8000});
  await expect(frame.locator('#run')).toBeEnabled({timeout:8000});
  await frame.locator('#run').click();
  await expect(frame.locator('#status')).toHaveText('OK',{timeout:8000});
  await expect(frame.locator('#net')).toContainText('125.00');
  await expect(frame.locator('#quota')).toContainText('49/50');
  await expect(frame.locator('#run')).toBeEnabled();
});
