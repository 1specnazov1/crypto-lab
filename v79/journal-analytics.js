'use strict';
(() => {
  const PROJECT_URL='https://txhzxbizjpinowepfjkm.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const client=supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  const $=id=>document.getElementById(id);
  let data=null,loading=false;
  const T={
    ru:{title:'Расширенная аналитика',period:'Период',d30:'30 дней',d90:'90 дней',d365:'1 год',all:'Всё время',refresh:'Обновить',trades:'Сделок',win:'Win Rate',net:'Чистый P&L',pf:'Profit Factor',avg:'Средняя сделка',hold:'Среднее удержание',best:'Лучшая сделка',streak:'Макс. серия побед',equity:'Накопленный P&L',symbols:'Монеты',strategies:'Стратегии',direction:'LONG / SHORT',empty:'Недостаточно закрытых сделок',login:'Войдите в аккаунт для аналитики',error:'Не удалось загрузить аналитику',minutes:'мин'},
    uk:{title:'Розширена аналітика',period:'Період',d30:'30 днів',d90:'90 днів',d365:'1 рік',all:'Увесь час',refresh:'Оновити',trades:'Угод',win:'Win Rate',net:'Чистий P&L',pf:'Profit Factor',avg:'Середня угода',hold:'Середнє утримання',best:'Найкраща угода',streak:'Макс. серія перемог',equity:'Накопичений P&L',symbols:'Монети',strategies:'Стратегії',direction:'LONG / SHORT',empty:'Недостатньо закритих угод',login:'Увійдіть в акаунт для аналітики',error:'Не вдалося завантажити аналітику',minutes:'хв'},
    en:{title:'Advanced analytics',period:'Period',d30:'30 days',d90:'90 days',d365:'1 year',all:'All time',refresh:'Refresh',trades:'Trades',win:'Win Rate',net:'Net P&L',pf:'Profit Factor',avg:'Average trade',hold:'Average holding',best:'Best trade',streak:'Max win streak',equity:'Cumulative P&L',symbols:'Assets',strategies:'Strategies',direction:'LONG / SHORT',empty:'Not enough closed trades',login:'Sign in to view analytics',error:'Could not load analytics',minutes:'min'}
  };
  function lang(){return localStorage.getItem('cryptoLabLanguage')||document.documentElement.lang||'ru'}
  function tr(){return T[lang()]||T.ru}
  function money(v){const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':'−'}$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'}
  function number(v,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
  function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function install(){
    if($('journalAnalytics'))return;
    const anchor=document.querySelector('.metrics');
    if(!anchor)return;
    const section=document.createElement('section');
    section.id='journalAnalytics';
    section.className='analytics-card';
    section.innerHTML=`<div class="analytics-head"><div><h2 id="jaTitle"></h2><small id="jaState" class="muted"></small></div><div class="analytics-controls"><label id="jaPeriodLabel"></label><select id="jaPeriod"><option value="30"></option><option value="90" selected></option><option value="365"></option><option value="0"></option></select><button class="btn" id="jaRefresh"></button></div></div><div id="jaMetrics" class="analytics-metrics"></div><div class="analytics-grid"><div class="analytics-panel"><h3 id="jaEquityTitle"></h3><svg id="jaChart" viewBox="0 0 900 260" preserveAspectRatio="none"></svg></div><div class="analytics-panel"><h3 id="jaDirectionTitle"></h3><div id="jaDirection"></div></div><div class="analytics-panel"><h3 id="jaSymbolsTitle"></h3><div id="jaSymbols"></div></div><div class="analytics-panel"><h3 id="jaStrategiesTitle"></h3><div id="jaStrategies"></div></div></div>`;
    anchor.insertAdjacentElement('afterend',section);
    const style=document.createElement('style');
    style.id='journalAnalyticsStyle';
    style.textContent='.analytics-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.analytics-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line)}.analytics-head h2,.analytics-panel h3{margin:0}.analytics-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.analytics-controls label{color:var(--muted)}.analytics-metrics{display:grid;grid-template-columns:repeat(8,minmax(105px,1fr));gap:8px;padding:10px}.analytics-metric{padding:10px;background:var(--panel2);border:1px solid var(--line);border-radius:8px}.analytics-metric span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.analytics-metric b{display:block;margin-top:5px;font-size:16px}.analytics-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:0;border-top:1px solid var(--line)}.analytics-panel{padding:12px;min-width:0}.analytics-panel:nth-child(even){border-left:1px solid var(--line)}.analytics-panel:nth-child(n+3){border-top:1px solid var(--line)}#jaChart{width:100%;height:260px;background:#101317;border-radius:8px}.analytics-row{display:grid;grid-template-columns:minmax(80px,1fr) 55px 70px 75px;gap:8px;padding:7px 0;border-top:1px solid var(--line);align-items:center}.analytics-row:first-child{border-top:0}.analytics-row span{color:var(--muted)}.analytics-empty{padding:24px;color:var(--muted);text-align:center}@media(max-width:1100px){.analytics-metrics{grid-template-columns:repeat(4,1fr)}}@media(max-width:760px){.analytics-grid{grid-template-columns:1fr}.analytics-panel:nth-child(even){border-left:0}.analytics-panel:nth-child(n+2){border-top:1px solid var(--line)}.analytics-metrics{grid-template-columns:repeat(2,1fr)}.analytics-head{align-items:flex-start;flex-direction:column}}';
    document.head.appendChild(style);
    $('jaPeriod').onchange=load;
    $('jaRefresh').onclick=load;
    document.getElementById('lang')?.addEventListener('change',()=>setTimeout(()=>{translate();render()},0));
    const count=document.getElementById('rowCount');
    if(count)new MutationObserver(()=>{clearTimeout(install.refreshTimer);install.refreshTimer=setTimeout(load,400)}).observe(count,{childList:true,characterData:true,subtree:true});
    translate();load();
  }
  function translate(){
    const x=tr();
    $('jaTitle').textContent=x.title;$('jaPeriodLabel').textContent=x.period;$('jaRefresh').textContent=x.refresh;
    const o=$('jaPeriod').options;o[0].text=x.d30;o[1].text=x.d90;o[2].text=x.d365;o[3].text=x.all;
    $('jaEquityTitle').textContent=x.equity;$('jaSymbolsTitle').textContent=x.symbols;$('jaStrategiesTitle').textContent=x.strategies;$('jaDirectionTitle').textContent=x.direction;
  }
  async function load(){
    if(loading)return;
    loading=true;$('jaRefresh').disabled=true;$('jaState').textContent='…';
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session){data=null;$('jaState').textContent=tr().login;render();return}
      const {data:result,error}=await client.rpc('get_my_crypto_journal_analytics',{p_days:Number($('jaPeriod').value)});
      if(error)throw error;
      data=result;$('jaState').textContent=new Date(result.generated_at).toLocaleString();render();
    }catch(error){data=null;$('jaState').textContent=`${tr().error}: ${error.message||error}`;render()}
    finally{loading=false;$('jaRefresh').disabled=false}
  }
  function render(){
    if(!$('jaMetrics'))return;
    translate();
    if(!data||!data.summary||!data.summary.trades){
      $('jaMetrics').innerHTML=`<div class="analytics-empty" style="grid-column:1/-1">${safe($('jaState').textContent||tr().empty)}</div>`;
      ['jaDirection','jaSymbols','jaStrategies'].forEach(id=>$(id).innerHTML=`<div class="analytics-empty">${tr().empty}</div>`);
      $('jaChart').innerHTML='';return;
    }
    const s=data.summary,x=tr(),metrics=[[x.trades,s.trades],[x.win,`${number(s.win_rate)}%`],[x.net,money(s.net_pnl)],[x.pf,s.profit_factor==null?'∞':number(s.profit_factor)],[x.avg,money(s.average_pnl)],[x.hold,`${number(s.average_holding_minutes,0)} ${x.minutes}`],[x.best,money(s.best_trade)],[x.streak,s.max_win_streak]];
    $('jaMetrics').innerHTML=metrics.map(([label,value])=>`<div class="analytics-metric"><span>${safe(label)}</span><b>${safe(value)}</b></div>`).join('');
    renderChart(data.equity_curve||[]);renderRows('jaDirection',data.by_direction||[],'direction');renderRows('jaSymbols',data.by_symbol||[],'symbol');renderRows('jaStrategies',data.by_strategy||[],'strategy');
  }
  function renderRows(id,rows,key){
    $(id).innerHTML=rows.length?rows.map(row=>`<div class="analytics-row"><b>${safe(row[key])}</b><span>${safe(row.trades)}</span><span>${safe(number(row.win_rate,1))}%</span><b class="${Number(row.net_pnl)>=0?'pos':'neg'}">${safe(money(row.net_pnl))}</b></div>`).join(''):`<div class="analytics-empty">${tr().empty}</div>`;
  }
  function renderChart(points){
    const svg=$('jaChart');svg.innerHTML='';
    if(points.length<2){svg.innerHTML=`<text x="450" y="130" text-anchor="middle" fill="#848e9c">${safe(tr().empty)}</text>`;return}
    const values=points.map(p=>Number(p.equity)||0),min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;
    const coords=values.map((v,i)=>[20+i/(values.length-1)*860,235-(v-min)/range*210]);
    const line=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '),zeroY=235-(0-min)/range*210,last=coords[coords.length-1];
    svg.innerHTML=`<line x1="20" y1="${zeroY}" x2="880" y2="${zeroY}" stroke="#2b3139"/><path d="${line}" fill="none" stroke="#f0b90b" stroke-width="3"/><circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#f0b90b"/><text x="24" y="20" fill="#848e9c">${safe(money(max))}</text><text x="24" y="252" fill="#848e9c">${safe(money(min))}</text>`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();