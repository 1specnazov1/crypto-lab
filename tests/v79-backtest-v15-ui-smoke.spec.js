import { test, expect } from '@playwright/test';

const STUB=`
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{access_token:'owner-token',user:{id:'owner'}}},error:null})},
  rpc:async name=>name==='get_crypto_feature_status'?{data:{allowed:true,remaining:49,limit:50},error:null}:{data:{},error:null}
})};`;

async function base(page){
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:STUB}));
}

test('Scanner v15 EXACT fails closed when rank archive does not cover requested period',async({page})=>{
  await base(page);
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-backtest-v15',r=>r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,code:'PARITY_DATA_INSUFFICIENT',error:'Exact replay requires archive',parity:{mode:'EXACT',rank_archive_from:'2026-08-14T14:39:12.504Z',requested_from:'2026-08-01T00:00:00Z'}})}));
  await page.goto('/v79/backtest-v15.html',{waitUntil:'domcontentloaded'});
  await page.click('#run');
  await expect(page.locator('#status')).toHaveText('PARITY DATA INSUFFICIENT');
  await expect(page.locator('#notice')).toContainText('Архив liquidity rank начинается');
  await expect(page.locator('#count')).toHaveText('—');
});

test('Scanner v15 EXACT renders parity metadata and replay trades',async({page})=>{
  await base(page);
  const body={ok:true,symbol:'BTC',interval:'5m',engine:'SCANNER_V15_EXACT',parity:{mode:'EXACT',scanner_version:15,rank_archive_from:'2026-08-14T14:39:12.504Z',news_archive:true},quota:{allowed:true,remaining:48,limit:50},result:{engineVersion:15,capital:10000,equity:10100,net:100,returnPct:1,maxDrawdown:.4,candidates:2,start:1,end:2,all:{count:1,wins:1,losses:0,winRate:100,profitFactor:null,pnl:100,averageR:1},long:{count:1,wins:1,losses:0,winRate:100,profitFactor:null,pnl:100,averageR:1},short:{count:0,wins:0,losses:0,winRate:0,profitFactor:0,pnl:0,averageR:0},curve:[],trades:[{dir:'LONG',setup:'CONTINUATION',entryTime:1,exitTime:2,entry:100,stop:99,tp1:101,tp2:101.6,tp3:102.5,exit:101,reason:'PROTECTED_TP1',qty:10,pnl:100,r:1,equity:10100,score:97,rank:1}]}};
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-backtest-v15',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
  await page.goto('/v79/backtest-v15.html',{waitUntil:'domcontentloaded'});
  await page.selectOption('#interval','5m');
  await page.click('#run');
  await expect(page.locator('#status')).toHaveText('OK');
  await expect(page.locator('#engine')).toContainText('SCANNER_V15_EXACT');
  await expect(page.locator('#mode')).toHaveText('EXACT');
  await expect(page.locator('#candidates')).toHaveText('2');
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('#body tr')).toHaveCount(1);
  await expect(page.locator('#body')).toContainText('PROTECTED_TP1');
});
