import { test, expect } from '@playwright/test';

const EN='Brazil central bank says inflation remains demand-driven despite growing impact of rate hikes';
const RU='Центробанк Бразилии: инфляция остаётся обусловленной спросом, несмотря на растущее влияние повышения ставок';
const UK='Центробанк Бразилії: інфляція залишається зумовленою попитом попри зростаючий вплив підвищення ставок';
const BASES=['BTC','ETH','SOL','XRP','BNB','DOGE','LINK','SUI','ADA','AVAX','ONDO','XLM'];
const TICKERS=BASES.map((base,i)=>({symbol:base+'USDT',lastPrice:String([64121,1889,75.93,1.0078,610,.14,17.2,1.8,.6,30,.9,.12][i]),priceChangePercent:String([-0.67,-0.38,-0.42,-1.62,1.86,-.4,4.63,-1,-4.64,.8,1.2,-1.4][i]),quoteVolume:String(900000000-i*40000000)}));

async function stub(page){
  await page.addInitScript(()=>localStorage.setItem('sb-txhzxbizjpinowepfjkm-auth-token',JSON.stringify({access_token:'ticker-test-token'})));
  await page.route('https://**/*',async route=>{
    const raw=route.request().url(),u=new URL(raw);
    if(raw.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,server_time:new Date().toISOString(),latest_run:{finished_at:new Date().toISOString(),success:true,class_a_found:0,symbols_checked:20,timeframes:['5M']},scanner_job:{active:true},monitor_job:{active:false},signal_counts:{waiting:0,active:0,closed:397},signals:[],runs:[]})});
    if(raw.includes('/functions/v1/crypto-lab-v79-news')){
      const lang=u.searchParams.get('lang')||'en',localized=lang==='ru'?RU:lang==='uk'?UK:EN;
      const item={id:'ticker-1',region:'OTHER',category:'macro',title:EN,url:'https://example.invalid/news',domain:'reuters.com',published_at:new Date().toISOString(),source_tier:1,impact_score:82,urgency:3,direction:'negative',market_reason:'Macro test',is_breaking:true,localized_title:localized,metadata:{source_name:'Reuters'}};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[item],breaking:[item],language:lang,refresh_seconds:300})});
    }
    if(raw.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'invite_only_free',invite_valid:false,site_key:null,documents:[]})});
    if(raw.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,site_key:null})});
    if(raw.includes('data-api.binance.vision')||raw.includes('api.binance.com')){
      if(raw.includes('/api/v3/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(raw.includes('symbols=')?TICKERS:TICKERS[0])});
      if(raw.includes('/api/v3/ticker/price'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(TICKERS.map(x=>({symbol:x.symbol,price:x.lastPrice})))});
      if(raw.includes('/api/v3/klines')){const now=Date.now(),rows=Array.from({length:100},(_,i)=>{const o=63000+i*8,c=o+(i%2?8:-5),t=now-(100-i)*3600000;return[t,String(o),String(Math.max(o,c)+20),String(Math.min(o,c)-20),String(c),'10',t+3599999]});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});}
      return route.fulfill({status:404,contentType:'application/json',body:'{}'});
    }
    if(raw.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:`window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'ticker-test-token',user:{id:'ticker-user',email:'ticker@example.invalid'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:{ok:true,allowed:true},error:null})},rpc:async()=>({data:{},error:null}),from:()=>({select(){return this},eq(){return this},limit(){return Promise.resolve({data:[],error:null})}})}}};`});
    if(raw.includes('challenges.cloudflare.com'))return route.fulfill({status:200,contentType:'application/javascript',body:'window.turnstile={render(){return 1},reset(){},remove(){}};'});
    return route.abort();
  });
}

async function aligned(page){
  return page.evaluate(()=>{const t=document.getElementById('marketNewsTicker')?.getBoundingClientRect(),w=document.querySelector('.work')?.getBoundingClientRect(),f=document.getElementById('frame')?.getBoundingClientRect();return{tickerBottom:t?.bottom||0,workTop:w?.top||0,frameTop:f?.top||0,frameHeight:f?.height||0,rows:getComputedStyle(document.querySelector('.main')).gridTemplateRows}});
}

test('ticker never pushes chart or news modules down the viewport',async({page})=>{
  await stub(page);await page.goto('/v79/app.html?ticker-shell=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#marketNewsTicker')).toHaveClass(/show/);
  let pos=await aligned(page);expect(Math.abs(pos.workTop-pos.tickerBottom)).toBeLessThanOrEqual(2);expect(pos.rows.split(' ').length).toBeGreaterThanOrEqual(3);
  await page.locator('#nav button[data-route="analytics"]').click();await expect(page.locator('#frameView')).toBeVisible();pos=await aligned(page);expect(Math.abs(pos.frameTop-pos.tickerBottom)).toBeLessThanOrEqual(2);expect(pos.frameHeight).toBeGreaterThan(400);
  await page.locator('#nav button[data-route="news"]').click();await expect(page.frameLocator('#frame').locator('#title')).toBeVisible();pos=await aligned(page);expect(Math.abs(pos.frameTop-pos.tickerBottom)).toBeLessThanOrEqual(2);
});

test('breaking ticker follows RU UA EN language selection',async({page})=>{
  await stub(page);await page.goto('/v79/app.html?ticker-lang=1',{waitUntil:'domcontentloaded'});
  await page.locator('#lang').selectOption('ru');await expect(page.locator('#marketNewsTicker')).toHaveAttribute('data-label','⚡ СРОЧНО');await expect(page.locator('#marketNewsTrack')).toContainText('Центробанк Бразилии');await expect(page.locator('#marketNewsTrack')).toContainText('Влияние 82');
  await page.locator('#lang').selectOption('uk');await expect(page.locator('#marketNewsTicker')).toHaveAttribute('data-label','⚡ ТЕРМІНОВО');await expect(page.locator('#marketNewsTrack')).toContainText('Центробанк Бразилії');await expect(page.locator('#marketNewsTrack')).toContainText('Вплив 82');
  await page.locator('#lang').selectOption('en');await expect(page.locator('#marketNewsTicker')).toHaveAttribute('data-label','⚡ BREAKING');await expect(page.locator('#marketNewsTrack')).toContainText('Brazil central bank');await expect(page.locator('#marketNewsTrack')).toContainText('Impact 82');
});
