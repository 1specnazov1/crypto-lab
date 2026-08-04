'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, digits = 0) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const when = value => value ? new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(new Date(value)) : '—';
  const labels = {
    ru:{title:'Операционная готовность',refresh:'Обновить здоровье',scanner:'Сканер',monitor:'Монитор',stale:'Зависшие запуски',maintenance:'Обслуживание',billing:'Платёжный контур',healthy:'Норма',warning:'Внимание',unknown:'Нет данных',age:'мин назад',signals:'Сигналы',ai:'AI',backtest:'Бэктест',cron:'Фоновые задания',name:'Задание',schedule:'Расписание',status:'Статус',last:'Последний запуск',message:'Результат',registration:'Регистрация за 24 часа',deletions:'Запросы на удаление',none:'Нет данных',email:'Email',reason:'Причина',requested:'Запрошено',loading:'Загрузка операционной диагностики…',failed:'Ошибки',reviews:'Проверки',anomalies:'Аномалии',critical:'Критические',retry:'На повтор',outbox:'Telegram outbox',pending:'Ожидают',processing:'Обрабатываются',dead:'Ручная проверка',sent:'Отправлено',oldest:'Старейшее неотправленное',event:'Событие',asset:'Актив',attempts:'Попытки',telegram:'Telegram ID',created:'Создано',error:'Последняя ошибка'},
    uk:{title:'Операційна готовність',refresh:'Оновити стан',scanner:'Сканер',monitor:'Монітор',stale:'Завислі запуски',maintenance:'Обслуговування',billing:'Платіжний контур',healthy:'Норма',warning:'Увага',unknown:'Немає даних',age:'хв тому',signals:'Сигнали',ai:'AI',backtest:'Бектест',cron:'Фонові завдання',name:'Завдання',schedule:'Розклад',status:'Статус',last:'Останній запуск',message:'Результат',registration:'Реєстрація за 24 години',deletions:'Запити на видалення',none:'Немає даних',email:'Email',reason:'Причина',requested:'Запитано',loading:'Завантаження операційної діагностики…',failed:'Помилки',reviews:'Перевірки',anomalies:'Аномалії',critical:'Критичні',retry:'На повтор',outbox:'Telegram outbox',pending:'Очікують',processing:'Обробляються',dead:'Ручна перевірка',sent:'Надіслано',oldest:'Найстаріше ненадіслане',event:'Подія',asset:'Актив',attempts:'Спроби',telegram:'Telegram ID',created:'Створено',error:'Остання помилка'},
    en:{title:'Operational readiness',refresh:'Refresh health',scanner:'Scanner',monitor:'Monitor',stale:'Stale runs',maintenance:'Maintenance',billing:'Billing contour',healthy:'Healthy',warning:'Attention',unknown:'No data',age:'min ago',signals:'Signals',ai:'AI',backtest:'Backtest',cron:'Background jobs',name:'Job',schedule:'Schedule',status:'Status',last:'Last run',message:'Result',registration:'Registration in 24 hours',deletions:'Deletion requests',none:'No data',email:'Email',reason:'Reason',requested:'Requested',loading:'Loading operational diagnostics…',failed:'Failed',reviews:'Reviews',anomalies:'Anomalies',critical:'Critical',retry:'Retry due',outbox:'Telegram outbox',pending:'Pending',processing:'Processing',dead:'Manual review',sent:'Sent',oldest:'Oldest unsent',event:'Event',asset:'Asset',attempts:'Attempts',telegram:'Telegram ID',created:'Created',error:'Last error'}
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let busy = false;
  let visible = false;

  function styles(){
    if($('adminHealthStyles')) return;
    const style=document.createElement('style');
    style.id='adminHealthStyles';
    style.textContent='.health-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.health-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:10px}.health-stat{background:var(--p2);border:1px solid var(--line);border-radius:8px;padding:10px}.health-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.health-stat b{display:block;font-size:17px;margin-top:5px}.health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.health-panel{background:var(--p);border:1px solid var(--line);border-radius:10px;padding:13px;min-width:0}.health-panel h3{margin:0 0 9px}.health-table{overflow:auto;max-height:330px}.health-table table{min-width:720px}.health-badge{display:inline-flex;padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:9px}.health-badge.ok{color:#9cf0ca;border-color:#0ecb8145}.health-badge.bad{color:#ffc4cd;border-color:#f6465d45}.health-muted{color:var(--m);padding:12px 0}.health-error{color:#ffc4cd;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px;padding:10px}.outbox-error{display:block;max-width:260px;white-space:normal;overflow-wrap:anywhere;color:#ffc4cd}@media(max-width:1200px){.health-stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.health-stats{grid-template-columns:1fr 1fr}.health-grid{grid-template-columns:1fr}}@media(max-width:480px){.health-stats{grid-template-columns:1fr}.health-head button{width:100%;min-height:42px}}';
    document.head.appendChild(style);
  }

  function ensure(){
    if($('operationalHealth')) return $('operationalHealth');
    const dashboard=$('dashboard');
    if(!dashboard) return null;
    styles();
    const section=document.createElement('section');
    section.id='operationalHealth';
    section.className='card';
    section.style.marginTop='10px';
    section.innerHTML=`<div class="health-head"><div><h2>${t.title}</h2><div id="healthGenerated" class="muted">—</div></div><button id="healthRefresh" class="gold">${t.refresh}</button></div><div id="healthBody" class="health-muted">${t.loading}</div>`;
    dashboard.prepend(section);
    $('healthRefresh').onclick=load;
    return section;
  }

  function badge(ok){return `<span class="health-badge ${ok?'ok':'bad'}">${ok?t.healthy:t.warning}</span>`;}
  function statusBadge(status){const ok=status==='sent';return `<span class="health-badge ${ok?'ok':'bad'}">${esc(status||'—')}</span>`;}
  function listObject(value){const entries=Object.entries(value||{});return entries.length?entries.map(([key,count])=>`<div class="request-head"><span>${esc(key)}</span><b>${number(count)}</b></div>`).join(''):`<div class="health-muted">${t.none}</div>`;}
  function table(headers,rows){if(!rows.length)return `<div class="health-muted">${t.none}</div>`;return `<div class="health-table"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}

  function render(data){
    const scanner=data?.scanner||{},monitor=data?.monitor||{},outbox=data?.signal_outbox||{},stale=data?.stale_runs||{},maintenance=data?.last_maintenance||{},billing=data?.billing||{},jobs=Array.isArray(data?.cron_jobs)?data.cron_jobs:[],deletions=Array.isArray(data?.pending_deletions)?data.pending_deletions:[],outboxRecent=Array.isArray(outbox.recent)?outbox.recent:[];
    const scannerOk=scanner.last_success===true&&Number(scanner.age_minutes)<=30;
    const monitorOk=Number(monitor.age_minutes)<=5;
    const outboxOk=Number(outbox.pending||0)===0&&Number(outbox.retry||0)===0&&Number(outbox.processing||0)===0&&Number(outbox.dead||0)===0;
    const staleOk=Number(stale.ai||0)===0&&Number(stale.backtest||0)===0;
    const maintenanceAge=maintenance.completed_at?(Date.now()-new Date(maintenance.completed_at).getTime())/60000:null;
    const maintenanceOk=maintenance.status==='completed'&&maintenanceAge!==null&&maintenanceAge<=26*60;
    const billingOk=Number(billing.events_processing||0)===0&&Number(billing.events_failed||0)===0&&Number(billing.retry_due||0)===0&&Number(billing.review_required||0)===0&&Number(billing.open_anomalies||0)===0;
    $('healthGenerated').textContent=data?.generated_at?new Date(data.generated_at).toLocaleString():'—';
    $('healthBody').innerHTML=`
      <div class="health-stats">
        <div class="health-stat"><span>${t.scanner}</span><b>${scanner.age_minutes==null?t.unknown:`${number(scanner.age_minutes,1)} ${t.age}`}</b>${badge(scannerOk)}</div>
        <div class="health-stat"><span>${t.monitor}</span><b>${monitor.age_minutes==null?t.unknown:`${number(monitor.age_minutes,1)} ${t.age}`}</b>${badge(monitorOk)}</div>
        <div class="health-stat"><span>${t.outbox}</span><b>${t.pending} ${number(outbox.pending)} · ${t.dead} ${number(outbox.dead)}</b>${badge(outboxOk)}</div>
        <div class="health-stat"><span>${t.stale}</span><b>${t.ai} ${number(stale.ai)} · ${t.backtest} ${number(stale.backtest)}</b>${badge(staleOk)}</div>
        <div class="health-stat"><span>${t.maintenance}</span><b>${maintenance.completed_at?when(maintenance.completed_at):t.unknown}</b>${badge(maintenanceOk)}</div>
        <div class="health-stat"><span>${t.billing}</span><b>${t.anomalies} ${number(billing.open_anomalies)} · ${t.reviews} ${number(billing.review_required)}</b>${badge(billingOk)}</div>
      </div>
      <div class="health-grid">
        <div class="health-panel"><h3>${t.signals}</h3><div class="request-head"><span>WAITING</span><b>${number(monitor.waiting)}</b></div><div class="request-head"><span>ACTIVE</span><b>${number(monitor.active)}</b></div><div class="request-head"><span>CLOSED</span><b>${number(monitor.closed)}</b></div></div>
        <div class="health-panel"><h3>${t.outbox}</h3><div class="request-head"><span>${t.pending}</span><b>${number(outbox.pending)}</b></div><div class="request-head"><span>${t.retry}</span><b>${number(outbox.retry)}</b></div><div class="request-head"><span>${t.processing}</span><b>${number(outbox.processing)}</b></div><div class="request-head"><span>${t.dead}</span><b>${number(outbox.dead)}</b></div><div class="request-head"><span>${t.sent}</span><b>${number(outbox.sent)}</b></div><div class="request-head"><span>${t.oldest}</span><b>${outbox.oldest_unsent_minutes==null?'—':`${number(outbox.oldest_unsent_minutes,1)} ${t.age}`}</b></div></div>
        <div class="health-panel"><h3>${t.billing}</h3><div class="request-head"><span>${t.failed}</span><b>${number(billing.events_failed)}</b></div><div class="request-head"><span>${t.retry}</span><b>${number(billing.retry_due)}</b></div><div class="request-head"><span>${t.reviews}</span><b>${number(billing.review_required)}</b></div><div class="request-head"><span>${t.anomalies}</span><b>${number(billing.open_anomalies)}</b></div><div class="request-head"><span>${t.critical}</span><b>${number(billing.critical_anomalies)}</b></div></div>
        <div class="health-panel"><h3>${t.registration}</h3>${listObject(data?.registration_24h)}</div>
      </div>
      <div class="health-panel" style="margin-top:10px"><h3>${t.outbox} · ${number(outboxRecent.length)}</h3>${table([t.event,t.asset,t.status,t.attempts,t.telegram,t.created,t.error],outboxRecent.map(item=>`<tr><td><b>${esc(item.event_type||'—')}</b></td><td>${esc(item.symbol||'—')} · ${esc(item.timeframe||'—')} · ${esc(item.direction||'—')}</td><td>${statusBadge(item.status)}</td><td>${number(item.attempts)}</td><td>${esc(item.telegram_message_id||'—')}</td><td>${when(item.created_at)}</td><td><span class="outbox-error">${esc(item.last_error||'—')}</span></td></tr>`))}</div>
      <div class="health-panel" style="margin-top:10px"><h3>${t.cron}</h3>${table([t.name,t.schedule,t.status,t.last,t.message],jobs.map(job=>`<tr><td><b>${esc(job.name)}</b></td><td><code>${esc(job.schedule)}</code></td><td>${badge(job.active===true&&job.last_status==='succeeded')} <span class="muted">${esc(job.last_status||'—')}</span></td><td>${when(job.last_start_time)}</td><td>${esc(job.last_message||'—')}</td></tr>`))}</div>
      <div class="health-panel" style="margin-top:10px"><h3>${t.deletions} · ${number(deletions.length)}</h3>${table([t.email,t.reason,t.requested],deletions.map(item=>`<tr><td>${esc(item.email||'—')}</td><td>${esc(item.reason||'—')}</td><td>${when(item.requested_at)}</td></tr>`))}</div>`;
  }

  async function load(){if(busy||typeof sb==='undefined')return;ensure();busy=true;$('healthRefresh').disabled=true;$('healthBody').innerHTML=`<div class="health-muted">${t.loading}</div>`;try{const {data,error}=await sb.rpc('get_crypto_admin_operational_health');if(error)throw error;render(data||{});}catch(error){$('healthBody').innerHTML=`<div class="health-error">${esc(error?.message||error)}</div>`;}finally{busy=false;$('healthRefresh').disabled=false;}}
  function boot(){const panel=ensure();if(!panel)return;const dashboard=$('dashboard'),nowVisible=!!dashboard&&!dashboard.classList.contains('hide');if(nowVisible&&!visible)load();visible=nowVisible;const refresh=$('refresh');if(refresh&&!refresh.dataset.healthHook){refresh.dataset.healthHook='1';refresh.addEventListener('click',()=>setTimeout(load,0));}}
  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,3000);boot();
})();