'use strict';
(() => {
  const PROJECT_URL = 'https://txhzxbizjpinowepfjkm.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const sb = supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  let lang = Q.get('lang') || safeGet('cryptoLabLanguage') || 'ru';
  let session = null;
  let rows = [];
  let editorOpen = true;

  const T = {
    ru: { page:'Журнал сделок', authCheck:'Проверка аккаунта…', authNeeded:'Требуется вход в аккаунт', signed:'Аккаунт подключён', newTrade:'Новая сделка', editTrade:'Редактирование сделки', export:'CSV', hide:'Скрыть', show:'Показать редактор', closed:'Закрытых сделок', net:'Чистый P&L', avgR:'Средний R', open:'Открытых', symbol:'Монета', tf:'Таймфрейм', direction:'Направление', status:'Статус', entryTime:'Время входа', exitTime:'Время выхода', quantity:'Количество', leverage:'Плечо', fees:'Комиссии, USDT', strategy:'Стратегия', setup:'Сетап', tags:'Теги через запятую', notes:'Заметки', clear:'Очистить', save:'Сохранить', saving:'Сохранение…', saved:'Сделка сохранена', deleted:'Сделка удалена', history:'История сделок', refresh:'Обновить', allStatuses:'Все статусы', search:'Монета, стратегия или тег', entry:'Вход', asset:'Монета', actions:'Действия', edit:'Изменить', remove:'Удалить', empty:'Сделок пока нет', confirmDelete:'Удалить эту сделку?', invalidClosed:'Для закрытой сделки укажите время и цену выхода.', invalidEntry:'Укажите корректные цену входа и количество.', rows:'записей', loadError:'Не удалось загрузить журнал', formError:'Не удалось сохранить сделку', footer:'P&L рассчитывается по количеству актива: LONG = (Exit − Entry) × Quantity − Fees; SHORT = (Entry − Exit) × Quantity − Fees. Плечо сохраняется как параметр сделки и не умножает P&L повторно.', loginHint:'Откройте раздел «Аккаунт» и войдите. Данные журнала хранятся в Supabase и защищены RLS.' },
    uk: { page:'Журнал угод', authCheck:'Перевірка акаунта…', authNeeded:'Потрібен вхід в акаунт', signed:'Акаунт підключено', newTrade:'Нова угода', editTrade:'Редагування угоди', export:'CSV', hide:'Сховати', show:'Показати редактор', closed:'Закритих угод', net:'Чистий P&L', avgR:'Середній R', open:'Відкритих', symbol:'Монета', tf:'Таймфрейм', direction:'Напрямок', status:'Статус', entryTime:'Час входу', exitTime:'Час виходу', quantity:'Кількість', leverage:'Плече', fees:'Комісії, USDT', strategy:'Стратегія', setup:'Сетап', tags:'Теги через кому', notes:'Нотатки', clear:'Очистити', save:'Зберегти', saving:'Збереження…', saved:'Угоду збережено', deleted:'Угоду видалено', history:'Історія угод', refresh:'Оновити', allStatuses:'Усі статуси', search:'Монета, стратегія або тег', entry:'Вхід', asset:'Монета', actions:'Дії', edit:'Змінити', remove:'Видалити', empty:'Угод поки немає', confirmDelete:'Видалити цю угоду?', invalidClosed:'Для закритої угоди вкажіть час і ціну виходу.', invalidEntry:'Вкажіть коректні ціну входу та кількість.', rows:'записів', loadError:'Не вдалося завантажити журнал', formError:'Не вдалося зберегти угоду', footer:'P&L розраховується за кількістю активу: LONG = (Exit − Entry) × Quantity − Fees; SHORT = (Entry − Exit) × Quantity − Fees. Плече зберігається як параметр угоди й не множить P&L повторно.', loginHint:'Відкрийте розділ «Акаунт» і увійдіть. Дані журналу зберігаються в Supabase та захищені RLS.' },
    en: { page:'Trade journal', authCheck:'Checking account…', authNeeded:'Account sign-in required', signed:'Account connected', newTrade:'New trade', editTrade:'Edit trade', export:'CSV', hide:'Hide', show:'Show editor', closed:'Closed trades', net:'Net P&L', avgR:'Average R', open:'Open trades', symbol:'Asset', tf:'Timeframe', direction:'Direction', status:'Status', entryTime:'Entry time', exitTime:'Exit time', quantity:'Quantity', leverage:'Leverage', fees:'Fees, USDT', strategy:'Strategy', setup:'Setup', tags:'Comma-separated tags', notes:'Notes', clear:'Clear', save:'Save', saving:'Saving…', saved:'Trade saved', deleted:'Trade deleted', history:'Trade history', refresh:'Refresh', allStatuses:'All statuses', search:'Asset, strategy or tag', entry:'Entry', asset:'Asset', actions:'Actions', edit:'Edit', remove:'Delete', empty:'No trades yet', confirmDelete:'Delete this trade?', invalidClosed:'A closed trade requires an exit time and exit price.', invalidEntry:'Enter a valid entry price and quantity.', rows:'rows', loadError:'Could not load journal', formError:'Could not save trade', footer:'P&L uses asset quantity: LONG = (Exit − Entry) × Quantity − Fees; SHORT = (Entry − Exit) × Quantity − Fees. Leverage is stored as trade metadata and is not applied to P&L a second time.', loginHint:'Open Account and sign in. Journal data is stored in Supabase and protected by RLS.' }
  };

  function tr(){ return T[lang] || T.ru; }
  function safeGet(key){ try{return localStorage.getItem(key)}catch{return null} }
  function safeSet(key,value){ try{localStorage.setItem(key,value)}catch{} }
  function safe(value){ return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function number(id){ const value = Number($(id).value); return Number.isFinite(value) ? value : null; }
  function nullableNumber(id){ return $(id).value.trim() === '' ? null : number(id); }
  function money(value){ const n=Number(value); return Number.isFinite(n) ? `${n>=0?'+':''}$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`.replace('+$-','-$') : '—'; }
  function price(value){ const n=Number(value); return Number.isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:n>=1000?2:n>=1?6:10}) : '—'; }
  function localDate(value){ if(!value)return '—'; return new Intl.DateTimeFormat(lang==='uk'?'uk-UA':lang==='en'?'en-GB':'ru-RU',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
  function toLocalInput(value){ if(!value)return ''; const d=new Date(value); const shifted=new Date(d.getTime()-d.getTimezoneOffset()*60000); return shifted.toISOString().slice(0,16); }
  function toIso(value){ return value ? new Date(value).toISOString() : null; }
  function nowLocal(){ return toLocalInput(new Date().toISOString()); }
  function showNotice(message,bad=false){ const box=$('notice'); box.textContent=message; box.className='notice'+(bad?' bad':''); clearTimeout(showNotice.timer); showNotice.timer=setTimeout(()=>box.classList.add('hide'),6000); }
  function setDisabled(disabled){ $('saveBtn').disabled=disabled; $('refreshBtn').disabled=disabled; $('newBtn').disabled=disabled; $('exportBtn').disabled=disabled; }

  function translate(){
    document.documentElement.lang=lang; $('lang').value=lang;
    const map={pageTitle:'page',authState:'authCheck',newBtn:'newTrade',exportBtn:'export',closeEditorBtn:editorOpen?'hide':'show',closedLabel:'closed',netLabel:'net',avgRLabel:'avgR',openLabel:'open',editorTitle:$('tradeId').value?'editTrade':'newTrade',symbolLabel:'symbol',tfLabel:'tf',directionLabel:'direction',statusLabel:'status',entryTimeLabel:'entryTime',exitTimeLabel:'exitTime',quantityLabel:'quantity',leverageLabel:'leverage',feesLabel:'fees',strategyLabel:'strategy',setupLabel:'setup',tagsLabel:'tags',notesLabel:'notes',resetFormBtn:'clear',saveBtn:'save',tableTitle:'history',refreshBtn:'refresh',thEntry:'entry',thAsset:'asset',thDirection:'direction',thStatus:'status',thQty:'quantity',thPnl:'net',thStrategy:'strategy',thTags:'tags',thAction:'actions',footerNote:'footer'};
    Object.entries(map).forEach(([id,key])=>{const el=$(id);if(el)el.textContent=tr()[key]});
    $('filterStatus').options[0].text=tr().allStatuses;
    $('filterSearch').placeholder=tr().search;
    render();
    if(session)$('authState').textContent=tr().signed;
  }

  function resetForm(prefill=true){
    $('tradeForm').reset(); $('tradeId').value=''; $('symbol').value='BTC'; $('timeframe').value='1H'; $('direction').value='LONG'; $('status').value='OPEN'; $('entryTime').value=nowLocal(); $('quantity').value='1'; $('leverage').value='1'; $('fees').value='0'; $('formState').textContent='';
    if(prefill)applyQueryDraft();
    $('editorTitle').textContent=tr().newTrade;
  }

  function applyQueryDraft(){
    const symbol=(Q.get('symbol')||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(symbol)$('symbol').value=symbol;
    const direction=(Q.get('direction')||'').toUpperCase(); if(['LONG','SHORT'].includes(direction))$('direction').value=direction;
    const tf=(Q.get('tf')||'').toUpperCase(); if([...$('timeframe').options].some(o=>o.value===tf))$('timeframe').value=tf;
    const pairs=[['entry','entryPrice'],['stop','stopPrice'],['tp','takeProfitPrice']]; pairs.forEach(([query,id])=>{const value=Number(Q.get(query));if(Number.isFinite(value)&&value>0)$(id).value=String(value)});
    if(Q.get('sourceSignal'))$('setup').value=`Scanner signal ${Q.get('sourceSignal')}`;
  }

  function payload(){
    const status=$('status').value, entryPrice=number('entryPrice'), quantity=number('quantity'), exitPrice=nullableNumber('exitPrice'), exitTime=toIso($('exitTime').value);
    if(!(entryPrice>0)||!(quantity>0))throw Error(tr().invalidEntry);
    if(status==='CLOSED'&&(!(exitPrice>0)||!exitTime))throw Error(tr().invalidClosed);
    return {
      symbol:$('symbol').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20), timeframe:$('timeframe').value, direction:$('direction').value, status,
      strategy:$('strategy').value.trim()||null, setup:$('setup').value.trim()||null, entry_time:toIso($('entryTime').value), exit_time:status==='CLOSED'?exitTime:null,
      entry_price:entryPrice, exit_price:status==='CLOSED'?exitPrice:null, stop_price:nullableNumber('stopPrice'), take_profit_price:nullableNumber('takeProfitPrice'), quantity,
      leverage:number('leverage')||1, fees:number('fees')||0, notes:$('notes').value.trim()||null,
      tags:$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,20), source:Q.get('sourceSignal')?'scanner':'manual', source_signal_id:Q.get('sourceSignal')||null
    };
  }

  async function load(){
    const {data:{session:active},error:sessionError}=await sb.auth.getSession();
    if(sessionError)showNotice(sessionError.message,true);
    session=active;
    if(!session){ rows=[]; setDisabled(true); $('authState').textContent=tr().authNeeded; $('notice').textContent=tr().loginHint; $('notice').className='notice'; render(); return; }
    setDisabled(false); $('authState').textContent=tr().signed; $('refreshBtn').disabled=true;
    const {data,error}=await sb.from('crypto_trade_journal').select('*').order('entry_time',{ascending:false}).limit(1000);
    $('refreshBtn').disabled=false;
    if(error){showNotice(`${tr().loadError}: ${error.message}`,true);return}
    rows=Array.isArray(data)?data:[]; render();
  }

  function filtered(){
    const status=$('filterStatus').value, direction=$('filterDirection').value, query=$('filterSearch').value.trim().toLowerCase();
    return rows.filter(row=>(status==='all'||row.status===status)&&(direction==='all'||row.direction===direction)&&(!query||[row.symbol,row.strategy,row.setup,...(row.tags||[])].some(value=>String(value||'').toLowerCase().includes(query))));
  }

  function renderMetrics(){
    const closed=rows.filter(row=>row.status==='CLOSED'&&Number.isFinite(Number(row.realized_pnl))), wins=closed.filter(row=>Number(row.realized_pnl)>0), losses=closed.filter(row=>Number(row.realized_pnl)<0), net=closed.reduce((sum,row)=>sum+Number(row.realized_pnl),0), grossWin=wins.reduce((sum,row)=>sum+Number(row.realized_pnl),0), grossLoss=Math.abs(losses.reduce((sum,row)=>sum+Number(row.realized_pnl),0)), rRows=closed.filter(row=>Number.isFinite(Number(row.r_multiple))), avgR=rRows.length?rRows.reduce((sum,row)=>sum+Number(row.r_multiple),0)/rRows.length:null;
    $('closedCount').textContent=closed.length; $('openCount').textContent=rows.filter(row=>row.status==='OPEN').length;
    $('winRate').textContent=closed.length?`${(wins.length/closed.length*100).toFixed(1)}%`:'—';
    $('netPnl').textContent=closed.length?money(net):'—'; $('netPnl').className=net>=0?'pos':'neg';
    $('profitFactor').textContent=closed.length?(grossLoss>0?(grossWin/grossLoss).toFixed(2):(grossWin>0?'∞':'0.00')):'—';
    $('avgR').textContent=avgR==null?'—':`${avgR>=0?'+':''}${avgR.toFixed(2)}R`; $('avgR').className=avgR==null?'':avgR>=0?'pos':'neg';
  }

  function render(){
    renderMetrics(); const data=filtered(); $('rowCount').textContent=`${data.length} ${tr().rows}`;
    $('body').innerHTML=data.length?data.map(row=>`<tr><td>${localDate(row.entry_time)}</td><td><b>${safe(row.symbol)}</b></td><td>${safe(row.timeframe)}</td><td><span class="badge ${row.direction==='LONG'?'long':'short'}">${safe(row.direction)}</span></td><td><span class="badge ${String(row.status).toLowerCase()}">${safe(row.status)}</span></td><td>${price(row.entry_price)}</td><td>${price(row.exit_price)}</td><td>${price(row.stop_price)}</td><td>${price(row.take_profit_price)}</td><td>${price(row.quantity)}</td><td class="${Number(row.realized_pnl)>=0?'pos':'neg'}">${row.realized_pnl==null?'—':money(row.realized_pnl)}</td><td class="${Number(row.r_multiple)>=0?'pos':'neg'}">${row.r_multiple==null?'—':`${Number(row.r_multiple)>=0?'+':''}${Number(row.r_multiple).toFixed(2)}R`}</td><td>${safe(row.strategy||'—')}</td><td>${safe((row.tags||[]).join(', ')||'—')}</td><td><div class="row-actions"><button class="btn" data-edit="${safe(row.id)}">${tr().edit}</button><button class="btn bad" data-delete="${safe(row.id)}">${tr().remove}</button></div></td></tr>`).join(''):`<tr><td colspan="15" class="empty">${session?tr().empty:tr().loginHint}</td></tr>`;
    $('body').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.edit));
    $('body').querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>remove(button.dataset.delete));
  }

  function edit(id){
    const row=rows.find(item=>item.id===id); if(!row)return;
    editorOpen=true; $('editorCard').classList.remove('hide'); $('closeEditorBtn').textContent=tr().hide;
    $('tradeId').value=row.id; $('symbol').value=row.symbol; $('timeframe').value=row.timeframe; $('direction').value=row.direction; $('status').value=row.status; $('entryTime').value=toLocalInput(row.entry_time); $('exitTime').value=toLocalInput(row.exit_time); $('entryPrice').value=row.entry_price; $('exitPrice').value=row.exit_price??''; $('stopPrice').value=row.stop_price??''; $('takeProfitPrice').value=row.take_profit_price??''; $('quantity').value=row.quantity; $('leverage').value=row.leverage; $('fees').value=row.fees; $('strategy').value=row.strategy||''; $('setup').value=row.setup||''; $('tags').value=(row.tags||[]).join(', '); $('notes').value=row.notes||''; $('editorTitle').textContent=tr().editTrade; scrollTo({top:0,behavior:'smooth'});
  }

  async function remove(id){
    if(!confirm(tr().confirmDelete))return;
    const {error}=await sb.from('crypto_trade_journal').delete().eq('id',id);
    if(error){showNotice(error.message,true);return}
    showNotice(tr().deleted); await load();
  }

  async function submit(event){
    event.preventDefault(); if(!session){showNotice(tr().loginHint,true);return}
    let data; try{data=payload()}catch(error){showNotice(error.message,true);return}
    $('saveBtn').disabled=true; $('formState').textContent=tr().saving;
    const id=$('tradeId').value; const result=id?await sb.from('crypto_trade_journal').update(data).eq('id',id).select('id').single():await sb.from('crypto_trade_journal').insert(data).select('id').single();
    $('saveBtn').disabled=false; $('formState').textContent='';
    if(result.error){showNotice(`${tr().formError}: ${result.error.message}`,true);return}
    showNotice(tr().saved); resetForm(false); await load();
  }

  function exportCsv(){
    if(!rows.length)return;
    const columns=['entry_time','exit_time','symbol','timeframe','direction','status','entry_price','exit_price','stop_price','take_profit_price','quantity','leverage','fees','realized_pnl','risk_amount','r_multiple','strategy','setup','tags','notes','source'];
    const quote=value=>`"${String(Array.isArray(value)?value.join('|'):value??'').replace(/"/g,'""')}"`;
    const csv=[columns.join(','),...rows.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`crypto-lab-trade-journal-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  $('tradeForm').addEventListener('submit',submit);
  $('resetFormBtn').onclick=()=>resetForm(false);
  $('newBtn').onclick=()=>{editorOpen=true;$('editorCard').classList.remove('hide');resetForm(true);scrollTo({top:0,behavior:'smooth'})};
  $('closeEditorBtn').onclick=()=>{editorOpen=!editorOpen;$('editorCard').classList.toggle('hide',!editorOpen);$('closeEditorBtn').textContent=editorOpen?tr().hide:tr().show};
  $('refreshBtn').onclick=load; $('exportBtn').onclick=exportCsv;
  ['filterStatus','filterDirection'].forEach(id=>$(id).onchange=render); $('filterSearch').oninput=render;
  $('lang').onchange=event=>{lang=event.target.value;safeSet('cryptoLabLanguage',lang);translate()};
  sb.auth.onAuthStateChange((_event,newSession)=>{session=newSession;load()});
  resetForm(true); translate(); load();
})();