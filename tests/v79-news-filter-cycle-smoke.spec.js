import { test, expect } from '@playwright/test';

const NOW=new Date().toISOString();
const ITEMS=[
  {id:'critical-breaking',region:'US',category:'regulation',title:'Critical breaking crypto policy event',localized_title:'Критическое срочное крипто-событие',url:'https://example.invalid/critical',domain:'reuters.com',published_at:NOW,source_tier:1,impact_score:86,urgency:3,direction:'negative',market_reason:'Critical test',is_breaking:true,metadata:{source_name:'Reuters'}},
  {id:'high-only',region:'US',category:'crypto',title:'High impact crypto market event',localized_title:'Важное крипто-событие',url:'https://example.invalid/high',domain:'bloomberg.com',published_at:NOW,source_tier:2,impact_score:78,urgency:2,direction:'positive',market_reason:'High test',is_breaking:false,metadata:{source_name:'Bloomberg'}},
  {id:'normal-impact',region:'US',category:'macro',title:'Moderate crypto macro event',localized_title:'Умеренное макро-событие',url:'https://example.invalid/moderate',domain:'example.com',published_at:NOW,source_tier:3,impact_score:61,urgency:1,direction:'neutral',market_reason:'Moderate test',is_breaking:false,metadata:{source_name:'Example'}}
];
const MARKET=[{symbol:'BTCUSDT',lastPrice:'64000',priceChangePercent:'0.5',quoteVolume:'1000000000'},{symbol:'ETHUSDT',lastPrice:'1900',priceChangePercent:'0.3',quoteVolume:'500000000'},{symbol:'SOLUSDT',lastPrice:'76',priceChangePercent:'1.2',quoteVolume:'300000000'},{symbol:'XRPUSDT',lastPrice:'1.02',priceChangePercent:'-0.4',quoteVolume:'200000000'}];

async function stub(page){
  await page.addInitScript(()=>{
    localStorage.setItem('cryptoLabLanguage','ru');
    localStorage.setItem('sb-txhzxbizjpinowepfjkm-auth-token',JSON.stringify({access_token:'news-filter-token'}));
  });
  await page.route('https://**/*',async route=>{
    const raw=route.request().url();
    if(raw.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,server_time:NOW,latest_run:{finished_at:NOW,success:true,class_a_found:0,symbols_checked:20,timeframes:['5M']},scanner_job:{active:true},monitor_job:{active:false},signal_counts:{waiting:0,active:0,closed:0},signals:[],runs:[]})});
    if(raw.includes('/functions/v1/crypto-lab-v79-news'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:ITEMS,breaking:[ITEMS[0]],state:{status:'ok',accepted_count:3,last_finished_at:NOW},server_time:NOW,refresh_seconds:300})});
    if(raw.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'invite_only_free',invite_valid:false,site_key:null,documents:[]})});
    if(raw.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,site_key:null})});
    if(raw.includes('data-api.binance.vision')||raw.includes('api.binance.com')){
      if(raw.includes('/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(raw.includes('symbols=')?MARKET:MARKET[0])});
      if(raw.includes('/ticker/price'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbol:'BTCUSDT',price:'64000'})});
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    }
    if(raw.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}}};'});
    if(raw.includes('challenges.cloudflare.com'))return route.fulfill({status:200,contentType:'application/javascript',body:'window.turnstile={render(){return 1},reset(){},remove(){}};'});
    return route.abort();
  });
}

test('news summary Critical High and Breaking cards filter the feed and subtitle is inline',async({page})=>{
  await stub(page);
  await page.goto('/v79/app.html?news-filter-cycle=1',{waitUntil:'domcontentloaded'});
  await page.locator('#nav button[data-route="news"]').click();
  const frame=page.frameLocator('#frame');
  await expect(frame.locator('#cryptoNewsUiUpgradesScript')).toHaveCount(1);
  await expect(frame.locator('#title')).toContainText('Новости · влияние на рынок · Только события');
  await expect(frame.locator('#subtitle')).toBeHidden();
  await expect(frame.locator('.item')).toHaveCount(3);

  await frame.locator('[data-news-filter="high"]').click();
  await expect(frame.locator('#impact')).toHaveValue('75');
  await expect(frame.locator('.item:visible')).toHaveCount(1);
  await expect(frame.locator('.item:visible .score strong')).toContainText('78');

  await frame.locator('[data-news-filter="critical"]').click();
  await expect(frame.locator('#impact')).toHaveValue('82');
  await expect(frame.locator('.item:visible')).toHaveCount(1);
  await expect(frame.locator('.item:visible .score strong')).toContainText('86');

  await frame.locator('[data-news-filter="breaking"]').click();
  await expect(frame.locator('#impact')).toHaveValue('55');
  await expect(frame.locator('.item:visible')).toHaveCount(1);
  await expect(frame.locator('.item:visible')).toHaveClass(/breaking/);

  await frame.locator('#regions [data-region="ALL"]').click();
  await expect(frame.locator('#impact')).toHaveValue('55');
  await expect(frame.locator('.item:visible')).toHaveCount(3);
  const mode=await frame.locator('body').evaluate(()=>window.CRYPTO_NEWS_UI_UPGRADES?.mode);
  expect(mode).toBe('all');
});

test('breaking ticker auto-hides after exactly three full passes and returns only for new content',async({page})=>{
  await stub(page);
  await page.goto('/v79/app.html?ticker-three-passes=1',{waitUntil:'domcontentloaded'});
  const ticker=page.locator('#marketNewsTicker'),track=page.locator('#marketNewsTrack');
  await expect(ticker).toHaveClass(/show/);
  await expect(page.locator('#newsTickerToggle')).toBeChecked();

  for(let i=0;i<2;i++){
    await track.dispatchEvent('animationiteration');
    await expect(ticker).toHaveClass(/show/);
  }
  await track.dispatchEvent('animationiteration');
  await expect(ticker).not.toHaveClass(/show/);
  await expect(page.locator('#newsTickerToggle')).not.toBeChecked();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cryptoLabBreakingTickerDismissedV1')||'null'));
  expect(stored?.reason).toBe('completed');

  await page.locator('#newsTickerToggle').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))});
  await expect(ticker).not.toHaveClass(/show/);
  await expect(page.locator('#newsTickerToggle')).not.toBeChecked();

  await track.evaluate(el=>{el.textContent=(el.textContent||'')+' · NEW HOT STORY'});
  await expect(ticker).toHaveClass(/show/);
  await expect(page.locator('#newsTickerToggle')).toBeChecked();
  const passes=await page.evaluate(()=>window.CRYPTO_NEWS_TICKER_PASSES?.passes||0);
  expect(passes).toBe(0);
});
