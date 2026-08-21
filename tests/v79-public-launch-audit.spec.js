import { test, expect } from '@playwright/test';

const ROUTES = ['home','analytics','news','scanner','ai','portfolio','calculator','backtest','journal','education','account','support'];
const BINANCE_KLINES=Array.from({length:120},(_,i)=>{const t=Date.UTC(2026,7,9,0,i),o=65000+i*2,c=o+(i%2?3:-2);return[t,String(o),String(Math.max(o,c)+8),String(Math.min(o,c)-8),String(c),String(12+i/10),t+59999]});
const BINANCE_TICKER={symbol:'BTCUSDT',lastPrice:'65123.45',priceChangePercent:'1.25',quoteVolume:'1450000000'};
const AUDIT_BASES=['BTC','ETH','SOL','XRP','BNB','DOGE','LINK','SUI','ADA','AVAX','ONDO','XLM'];
const AUDIT_CHANGES=[1.25,.8,2.4,-.4,.5,3.1,1.6,-1.2,.7,-1.8,2.1,-.3];
const BINANCE_BASKET=AUDIT_BASES.map((base,i)=>({symbol:base+'USDT',lastPrice:String([65123.45,1927.2,76.9,1.033,612.4,.152,16.8,1.92,.61,31.2,.91,.128][i]),priceChangePercent:String(AUDIT_CHANGES[i]),quoteVolume:String(1450000000-i*55000000)}));
const NEWS={ok:true,items:[{id:'n1',region:'US',category:'regulation',title:'Test market-moving policy headline',url:'https://example.invalid/news',domain:'reuters.com',published_at:new Date().toISOString(),source_tier:2,impact_score:92,urgency:3,direction:'positive',market_reason:'Policy can affect digital-asset capital flows.',is_breaking:true,metadata:{reason_key:'regulation',source_name:'Reuters',watch_entities:['Donald Trump / White House']}}],breaking:[{id:'n1',region:'US',category:'regulation',title:'Test market-moving policy headline',url:'https://example.invalid/news',domain:'reuters.com',published_at:new Date().toISOString(),source_tier:2,impact_score:92,urgency:3,direction:'positive',market_reason:'Policy can affect digital-asset capital flows.',is_breaking:true,metadata:{reason_key:'regulation',source_name:'Reuters',watch_entities:['Donald Trump / White House']}}],state:{status:'ok',accepted_count:1,last_finished_at:new Date().toISOString()},refresh_seconds:300};
const SUPABASE_STUB=`
(() => {
  const session={access_token:'audit-token',user:{id:'audit-owner',email:'audit-owner@example.invalid'}};let signedIn=true,callback=null;
  const account={effective_plan:'FREE',profile:{display_name:'Audit Owner',language:'ru',timezone:'Europe/Kyiv',role:'admin'},subscription:{status:'active',current_period_end:null},limits:{daily_ai_requests:5,daily_backtests:50,daily_exact_backtests:25,daily_chart_views:100,daily_scanner_views:-1,max_portfolio_assets:-1,max_favorites:-1},usage_today:{ai_requests:0,backtests:0,exact_backtests:0,chart_views:0,scanner_views:0},counts:{portfolio_assets:0,favorites:0}};
  const plans=[{plan:'FREE',display_order:1,daily_ai_requests:5,daily_backtests:50,daily_exact_backtests:25,daily_chart_views:100,daily_scanner_views:-1,max_portfolio_assets:-1,max_favorites:-1}];
  const chain=table=>{let op='select';const q={select(){op='select';return q},update(){op='update';return q},insert(){op='insert';return q},upsert(){op='upsert';return q},delete(){op='delete';return q},eq(){return q},neq(){return q},gt(){return q},gte(){return q},lt(){return q},lte(){return q},in(){return q},is(){return q},order(){return q},limit(){return q},range(){return q},maybeSingle(){return Promise.resolve({data:null,error:null})},single(){return Promise.resolve({data:null,error:null})},then(resolve,reject){const data=table==='crypto_plan_limits'?plans:[];return Promise.resolve({data:op==='select'?data:null,error:null}).then(resolve,reject)}};return q};
  const client={auth:{getSession:async()=>({data:{session:signedIn?session:null},error:null}),onAuthStateChange:cb=>{callback=cb;return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{signedIn=false;callback?.('SIGNED_OUT',null);return{error:null}},signInWithPassword:async()=>{signedIn=true;callback?.('SIGNED_IN',session);return{data:{session},error:null}},signUp:async()=>({data:{session:null},error:null}),resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null})},rpc:async(name,args)=>{if(name==='get_my_crypto_account')return{data:account,error:null};if(name==='get_crypto_feature_status'){const feature=args?.p_feature||'ai';const limits={ai:5,backtest:50,exact_backtest:25,chart:100,scanner:-1};const limit=limits[feature]??-1;return{data:{feature,allowed:true,remaining:limit<0?null:limit,limit},error:null}}if(name==='get_my_crypto_support_tickets')return{data:[],error:null};if(name==='get_crypto_admin_summary')return{data:{users_total:1,plans:{FREE:1},pending_requests:[],recent_users:[]},error:null};return{data:{},error:null}},functions:{invoke:async(name,opts)=>{if(name==='crypto-lab-v79-scanner')return{data:{free_access:true,signals:[],shadow_candidates:[],latest_run:{dry_run:true,telegram_sent:0},access:{quota:{remaining:null,limit:-1}}},error:null};if(name==='crypto-lab-v79-support')return{data:{ok:true,tickets:[],counts:{open:0,in_progress:0,resolved:0,closed:0}},error:null};if(name==='crypto-lab-v79-access-admin')return{data:{ok:true,requests:[]},error:null};return{data:{},error:null}}},from:chain};
  window.supabase={createClient:()=>client};
})();`;
const TURNSTILE_STUB=`window.turnstile={render:(target,opts)=>{setTimeout(()=>opts?.callback?.('audit-turnstile-token'),0);return 1},reset(){},remove(){}};`;

async function stub(page){
  await page.addInitScript(()=>localStorage.setItem('sb-txhzxbizjpinowepfjkm-auth-token',JSON.stringify({access_token:'audit-token'})));
  await page.route('https://**/*',async route=>{const url=route.request().url();
    if(url.includes('/functions/v1/crypto-lab-v79-chart'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,feature:'chart',quota:{allowed:true,feature:'chart',plan:'FREE',limit:100,used:1,remaining:99},rate:{remaining:29,window_seconds:60}})});
    if(url.includes('/functions/v1/crypto-lab-v79-preview'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,latest_run:{finished_at:new Date().toISOString(),class_a_found:0,dry_run:true,telegram_sent:0},scanner_job:{active:true},signal_counts:{waiting:0,active:0,closed:0},signals:[],runs:[],server_time:new Date().toISOString()})});
    if(url.includes('/functions/v1/crypto-lab-v79-news'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(NEWS)});
    if(url.includes('/functions/v1/crypto-lab-v79-register'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,registration_mode:'invite_only_free',request_access_enabled:true,free_access:true,invite_valid:false,site_key:null,captcha_action:'crypto_register',documents:[{key:'terms',version:'2026-08-03',url:'./terms.html'},{key:'privacy',version:'2026-08-03',url:'./privacy.html'},{key:'risk',version:'2026-08-03',url:'./risk-disclosure.html'}]})});
    if(url.includes('/functions/v1/crypto-lab-v79-recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true,site_key:'audit-site-key',captcha_action:'crypto_recover',email_enumeration_safe:true})});
    if(url.includes('/functions/v1/crypto-lab-v79-commercial'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,mode:'invite_free',paid_features_enabled:false,code:'PAID_FEATURES_DISABLED'})});
    if(url.includes('/functions/v1/crypto-lab-v79-onchain'))return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:'Authentication required'})});
    if(url.includes('api.binance.com'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    if(url.includes('data-api.binance.vision')){if(url.includes('/klines'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(BINANCE_KLINES)});if(url.includes('/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.includes('symbols=')?BINANCE_BASKET:BINANCE_TICKER)});if(url.includes('/ticker/price'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(BINANCE_BASKET.map(x=>({symbol:x.symbol,price:x.lastPrice})))});return route.fulfill({status:404,body:'{}'});}
    if(url.includes('cdn.jsdelivr.net'))return route.fulfill({status:200,contentType:'application/javascript',body:SUPABASE_STUB});
    if(url.includes('challenges.cloudflare.com'))return route.fulfill({status:200,contentType:'application/javascript',body:TURNSTILE_STUB});
    return route.abort();
  });
}
async function noOverflow(page){const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,b:document.body.scrollWidth,h:document.documentElement.scrollWidth}));expect(Math.max(d.b,d.h)).toBeLessThanOrEqual(d.w+3)}

test('shell is fast, complete, responsive and contains every navigation target',async({page})=>{
  await stub(page);const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  const started=Date.now();await page.goto('/v79/app.html?full-audit=1',{waitUntil:'domcontentloaded'});expect(Date.now()-started).toBeLessThan(3000);
  await expect(page.locator('#homeView')).toBeVisible();await expect(page.locator('#homeView')).toHaveClass(/ih/);await expect(page.locator('#homeBtcCanvas')).toHaveCount(0);await expect(page.locator('#ihHeat .ih-tile')).toHaveCount(12);await expect(page.locator('#ihOpp .ih-row')).toHaveCount(5);await expect(page.locator('#nav button[data-route="news"]')).toBeVisible();await noOverflow(page);
  const actual=await page.locator('#nav button[data-route]').evaluateAll(nodes=>nodes.map(n=>n.dataset.route));expect(actual).toEqual(ROUTES);expect(actual).not.toContain('market');
  await expect(page.locator('#marketNewsTicker')).toHaveClass(/show/);
  await page.locator('[data-r="analytics"]').first().click();await expect(page.locator('#frameView')).toBeVisible();await expect(page.locator('#frame')).toHaveAttribute('src',/chart-gate\.html/);
  expect(errors).toEqual([]);
});

test('news route renders impact feed and five-minute refresh contract',async({page})=>{
  await stub(page);await page.goto('/v79/app.html?full-audit=1',{waitUntil:'domcontentloaded'});await page.locator('#nav button[data-route="news"]').click();const frame=page.frameLocator('#frame');await expect(frame.locator('#title')).toContainText(/Новости|Новини|News/);await expect(frame.locator('.item')).toHaveCount(1);await expect(frame.locator('.item')).toContainText('Impact');await expect(frame.locator('.item')).toContainText('Reuters');
});

test('unified chart analytics renders real candles and timeframe-aware technical tools',async({page})=>{
  await stub(page);await page.goto('/v79/app.html?full-audit=1',{waitUntil:'domcontentloaded'});
  await page.locator('#nav button[data-route="analytics"]').click();
  await expect.poll(()=>page.frames().some(f=>/\/v79\/chart\.html/.test(new URL(f.url()).pathname)),{timeout:5000}).toBe(true);
  const frame=page.frameLocator('#frame');
  await expect(frame.locator('#analysisTools')).toBeVisible({timeout:5000});
  await expect.poll(async()=>frame.locator('#chart').evaluate(canvas=>{const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let candlePixels=0;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];if(a>80&&((g>150&&r<80&&b<170)||(r>190&&g<120&&b<140)))candlePixels++;}return candlePixels;}),{timeout:8000,message:'main chart must contain visible green/red candlestick pixels'}).toBeGreaterThan(100);
  await expect(frame.locator('[data-tool="ema"]')).toHaveAttribute('aria-pressed','true');
  await frame.locator('[data-tool="macd"]').click();
  await expect(frame.locator('[data-tool="macd"]')).toHaveAttribute('aria-pressed','true');
  await expect(frame.locator('#technicalAnalysisBody')).toContainText('MACD');
  const onchain=frame.locator('.analysis-tool').filter({hasText:'ON-CHAIN'});
  await expect(onchain).toBeVisible();
  await expect(onchain).not.toHaveClass(/unavailable/);
  await onchain.click();
  await expect(frame.locator('#onchainPanel')).toBeVisible();
  await expect(frame.locator('#onchainBody')).toContainText(/Authentication required|CRYPTO LAB/);
});

test('every concrete module renders, has unique ids, named controls and no placeholders',async({page})=>{
  await stub(page);const files=['chart.html','news.html','scanner.html','ai.html','portfolio.html','calculator.html','backtest.html','journal.html','education.html','account.html','support.html','admin.html'];
  for(const file of files){
    await page.goto(`/v79/${file}?full-audit=1`,{waitUntil:'domcontentloaded'});await expect(page.locator('body')).toBeVisible();
    const bad=await page.locator('button,input,select,textarea').evaluateAll(nodes=>nodes.filter(n=>{if(n.disabled||n.type==='hidden')return false;const text=(n.textContent||'').trim();const named=n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')||n.getAttribute('title')||n.getAttribute('placeholder')||n.getAttribute('name')||n.id||(n.labels&&n.labels.length);return n.tagName==='BUTTON'?!text&&!named:!named}).map(n=>n.outerHTML.slice(0,180)));expect(bad,`${file} unnamed controls`).toEqual([]);
    const duplicates=await page.locator('[id]').evaluateAll(nodes=>{const seen=new Set(),dups=[];for(const n of nodes){if(seen.has(n.id))dups.push(n.id);seen.add(n.id)}return[...new Set(dups)]});expect(duplicates,`${file} duplicate ids`).toEqual([]);
    const text=await page.locator('body').innerText();expect(text).not.toContain('Модуль в разработке');
  }
});

test('FREE release contains no user-facing payment checkout controls',async({page})=>{
  await stub(page);await page.goto('/v79/account.html?full-audit=1',{waitUntil:'domcontentloaded'});await expect(page.locator('#accountView')).toBeVisible();const text=(await page.locator('body').innerText()).toLowerCase();expect(text).not.toContain('купить pro');expect(text).not.toContain('оплатить');expect(await page.locator('#friendsFamilyPilot,#commercialCenter').count()).toBe(0);
});
