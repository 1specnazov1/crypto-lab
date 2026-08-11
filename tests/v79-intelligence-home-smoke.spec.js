import { test, expect } from '@playwright/test';

const BASES=['BTC','ETH','SOL','XRP','BNB','DOGE','LINK','SUI','ADA','AVAX','ONDO','XLM'];
const CHANGES=[1.8,1.2,3.4,-0.7,0.5,4.1,2.2,-1.4,0.9,-2.3,3.0,-0.4];
const PRICES=[65123.45,1927.2,76.9,1.033,612.4,0.152,16.8,1.92,0.61,31.2,0.91,0.128];
const TICKERS=BASES.map((base,index)=>({symbol:base+'USDT',lastPrice:String(PRICES[index]),priceChangePercent:String(CHANGES[index]),quoteVolume:String(2500000000-index*125000000)}));

async function stub(page){
  await page.route('https://**/*',async route=>{
    const url=route.request().url();
    if(url.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,server_time:new Date().toISOString(),latest_run:{finished_at:new Date().toISOString(),class_a_found:3,class_a:[],symbols_checked:20,timeframes:['5M','1H','4H']},signal_counts:{waiting:0,active:0,closed:0},scanner_job:{active:true},monitor_job:{active:false},signals:[],runs:[]})});
    if(url.includes('/functions/v1/crypto-lab-v79-news'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[],breaking:[],state:{status:'ok',accepted_count:0,last_finished_at:new Date().toISOString()},server_time:new Date().toISOString()})});
    if(url.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'invite_only_free',invite_valid:false,site_key:null,captcha_provider:'turnstile',captcha_action:'crypto_register',password_min_length:10,required_legal_keys:['terms','privacy','risk'],documents:[],readiness:{feature_flag:false,turnstile:true,mail_provider:true,legal_documents:true}})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,site_key:null,captcha_provider:'turnstile',captcha_action:'crypto_recover',email_enumeration_safe:true,readiness:{feature_flag:false,turnstile:true,mail_provider:true}})});
    if(url.includes('data-api.binance.vision')||url.includes('api.binance.com')){
      if(url.includes('/api/v3/ticker/24hr')){const multi=url.includes('symbols=');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(multi?TICKERS:TICKERS[0])});}
      if(url.includes('/api/v3/ticker/price'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(TICKERS.map(x=>({symbol:x.symbol,price:x.lastPrice})))});
      if(url.includes('/api/v3/klines')){const now=Date.now();const rows=Array.from({length:120},(_,i)=>{const o=64000+i*8,c=o+(i%2?-3:5),t=now-(120-i)*60000;return[t,String(o),String(Math.max(o,c)+12),String(Math.min(o,c)-10),String(c),String(10+i/10),t+59999]});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});}
      if(url.includes('/api/v3/exchangeInfo'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:[]})});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'});
    }
    if(url.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase=window.supabase||{createClient(){return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}}};'});
    return route.abort();
  });
}

async function open(page){await stub(page);await page.goto('/v79/app.html?intelligence-home-smoke=1',{waitUntil:'domcontentloaded'});await expect(page.locator('#homeView')).toHaveClass(/ih/);await expect(page.locator('#ihReg')).toBeVisible();}
async function expectCurrentLanguageTitle(page){const selected=await page.locator('#lang').inputValue();const expected=selected==='uk'?'Ринок за 30 секунд':selected==='en'?'Market in 30 seconds':'Рынок за 30 секунд';await expect(page.locator('#title')).toContainText(expected);}
async function noOverflow(page){const d=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,body:document.body.scrollWidth,doc:document.documentElement.scrollWidth,home:document.getElementById('homeView')?.scrollWidth||0}));expect(Math.max(d.body,d.doc,d.home)).toBeLessThanOrEqual(d.viewport+3);}

test('intelligence home replaces duplicate chart with decision dashboard',async({page})=>{
  await open(page);await expect(page.locator('#homeBtcCanvas')).toHaveCount(0);await expectCurrentLanguageTitle(page);await expect(page.locator('#statBtc')).toHaveText('$65,123.45');await expect(page.locator('#ihBreadth')).not.toHaveText('—');await expect(page.locator('#ihRisk')).not.toHaveText('—');await expect(page.locator('#ihOpp .ih-row')).toHaveCount(5);await expect(page.locator('#ihHeat .ih-tile')).toHaveCount(12);await expect(page.locator('#ihData')).toHaveText('ONLINE');await expect(page.locator('#serverText')).toContainText('FREE Scanner');await expect(page.locator('#serverBox')).not.toHaveClass(/bad/);const primary=await page.locator('.ih-actions>.ih-btn.main').boundingBox();expect(primary).not.toBeNull();expect(primary.width).toBeLessThanOrEqual(190);expect(primary.height).toBeLessThanOrEqual(40);await noOverflow(page);
});

test('intelligence home actions open the existing analytical modules',async({page})=>{await open(page);await page.locator('[data-r="analytics"]').first().click();await expect(page.locator('#frameView')).toBeVisible();await expect(page.locator('#frame')).toHaveAttribute('src',/chart\.html/);});

test('module navigation always resets shared iframe to the top',async({page})=>{
  await open(page);
  await page.locator('[data-r="analytics"]').first().click();
  await expect(page.locator('#frame')).toHaveAttribute('src',/chart\.html/);
  await expect(page.frameLocator('#frame').locator('#chart')).toBeVisible();
  await page.locator('#frame').evaluate(frame=>frame.contentWindow.scrollTo(0,700));
  await page.locator('#nav [data-route="news"]').click();
  await expect(page.locator('#frame')).toHaveAttribute('src',/news\.html/);
  await expect(page.frameLocator('#frame').locator('#title')).toBeVisible();
  await expect.poll(()=>page.locator('#frame').evaluate(frame=>frame.contentWindow.scrollY)).toBe(0);
});

test('intelligence home follows RU UA EN selection and persists it',async({page})=>{await open(page);await page.locator('#lang').selectOption('uk');await expect(page.locator('#title')).toContainText('Ринок за 30 секунд');await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#lang')).toHaveValue('uk');await expect(page.locator('#title')).toContainText('Ринок за 30 секунд');await page.locator('#lang').selectOption('en');await expect(page.locator('#title')).toContainText('Market in 30 seconds');await noOverflow(page);});
