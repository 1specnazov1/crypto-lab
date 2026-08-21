import { test, expect } from '@playwright/test';

const STUB=`
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{access_token:'owner-token',user:{id:'owner'}}},error:null})},
  rpc:async name=>name==='get_crypto_feature_status'?{data:{feature:'exact_backtest',allowed:true,remaining:24,limit:25},error:null}:{data:{},error:null}
})};`;

async function base(page){
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:STUB}));
}

const stats=(count,wins=0,pnl=0)=>({count,wins,losses:count-wins,winRate:count?100*wins/count:0,profitFactor:wins&&wins===count?null:wins?2.5:0,pnl,averageR:count?pnl/100/count:0});

test('Scanner v15 EXACT visibly truncates requests before production replay coverage instead of inventing history',async({page})=>{
  await base(page);
  const body={ok:true,engine:'SCANNER_V15_EXACT',replay_kind:'PRODUCTION_DECISION_REPLAY',parity:{mode:'EXACT',source:'crypto_shadow_signals',scanner_version:15,coverage_start:'2026-08-13T15:16:46.000Z',requested_from:'2026-08-01T00:00:00.000Z',effective_from:'2026-08-13T15:16:46.000Z',coverage_truncated:true,global_top3_preserved:true,production_dedupe_preserved:true,monitor_version:5},quota:{allowed:true,remaining:23,limit:25},result:{engineVersion:15,capital:10000,equity:10000,net:0,returnPct:0,maxDrawdown:0,signals:[],trades:[],counts:{signals:0,closed:0,expired:0},all:stats(0),long:stats(0),short:stats(0),start:1,end:2}};
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-backtest-v15',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
  await page.goto('/v79/backtest-v15.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#quota')).toContainText('25');
  await page.click('#run');
  await expect(page.locator('#status')).toHaveText('OK');
  await expect(page.locator('#notice')).toContainText('Exact coverage начинается');
  await expect(page.locator('#notice')).toContainText('Classic');
  await expect(page.locator('#signals')).toHaveText('0');
  await expect(page.locator('#closed')).toHaveText('0');
});

test('Scanner v15 EXACT renders actual production decisions and SHADOW lifecycle outcomes',async({page})=>{
  await base(page);
  const signal1={id:'s1',sourceRunId:893,symbol:'BTC',timeframe:'5M',dir:'SHORT',setup:'CONTINUATION',strength:97,status:'CLOSED',managementStage:'LOCK_TP1',createdAt:'2026-08-14T07:30:21Z',entryAt:'2026-08-14T07:31:59Z',tp1At:'2026-08-14T07:35:59Z',tp2At:'2026-08-14T07:57:59Z',tp3At:'2026-08-14T08:21:59Z',closedAt:'2026-08-14T08:21:59Z',closeType:'TP3',entry:100,entryLow:99.9,entryHigh:100.1,stop:101,tp1:99,tp2:98.4,tp3:97.5,rawR:2.5,liveEligible:true};
  const signal2={id:'s2',sourceRunId:900,symbol:'ETH',timeframe:'1H',dir:'LONG',setup:'PULLBACK',strength:96,status:'WAITING',managementStage:'ORIGINAL',createdAt:'2026-08-14T09:00:00Z',entryAt:null,tp1At:null,tp2At:null,tp3At:null,closedAt:null,closeType:null,entry:1900,entryLow:1898,entryHigh:1902,stop:1870,tp1:1930,tp2:1948,tp3:1966,rawR:null,liveEligible:true};
  const trade={...signal1,entryTime:1,exitTime:2,exit:97.5,reason:'TP3',qty:10,pnl:240,r:2.4,equity:10240};
  const body={ok:true,engine:'SCANNER_V15_EXACT',replay_kind:'PRODUCTION_DECISION_REPLAY',parity:{mode:'EXACT',source:'crypto_shadow_signals',scanner_version:15,coverage_start:'2026-08-13T15:16:46.000Z',requested_from:'2026-08-14T00:00:00Z',effective_from:'2026-08-14T00:00:00Z',coverage_truncated:false,global_top3_preserved:true,production_dedupe_preserved:true,monitor_version:5},quota:{allowed:true,remaining:23,limit:25},result:{engineVersion:15,capital:10000,equity:10240,net:240,returnPct:2.4,maxDrawdown:0,signals:[signal1,signal2],trades:[trade],counts:{signals:2,closed:1,expired:0},all:stats(1,1,240),long:stats(0),short:stats(1,1,240),start:1,end:2}};
  await page.route('https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-backtest-v15',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
  await page.goto('/v79/backtest-v15.html',{waitUntil:'domcontentloaded'});
  await page.click('#run');
  await expect(page.locator('#status')).toHaveText('OK');
  await expect(page.locator('#signals')).toHaveText('2');
  await expect(page.locator('#closed')).toHaveText('1');
  await expect(page.locator('#body tr')).toHaveCount(2);
  await expect(page.locator('#body')).toContainText('TP3');
  await expect(page.locator('#body')).toContainText('WAITING');
  await expect(page.locator('#net')).toContainText('$240');
});
