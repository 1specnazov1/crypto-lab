'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = (value,digits=0) => Number(value || 0).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const labels = {
    ru:{title:'SLO и запас мощности',refresh:'Обновить SLO',healthy:'Норма',warning:'Предупреждение',collecting:'Сбор данных',source:'Источник',success24:'Успех 24ч',success1:'Успех 1ч',p95:'p95',samples:'Наблюдения',last:'Последнее',thresholds:'Пороги',backpressure:'Очереди и мощность',outbox:'Telegram outbox',requests:'HTTP-наблюдения',capacity:'Покрытие монитора',cursor:'Отставание cron-курсоров',unsent:'Не отправлено',pending:'Ожидают обработки',oldest:'Старейшее',live:'Живые сигналы',limit:'Лимит',usage:'Использовано',job:'Задание',lag:'Не обработано',status:'Статус',total:'Всего',retention:'Хранение',days:'дн.',minutes:'мин',loading:'Загрузка SLO…',failed:'Не удалось загрузить SLO',none:'Нет данных',windowNote:'Предупреждение учитывает скользящее окно и может сохраняться после уже устранённого сбоя.'},
    uk:{title:'SLO і запас потужності',refresh:'Оновити SLO',healthy:'Норма',warning:'Попередження',collecting:'Збір даних',source:'Джерело',success24:'Успіх 24г',success1:'Успіх 1г',p95:'p95',samples:'Спостереження',last:'Останнє',thresholds:'Пороги',backpressure:'Черги й потужність',outbox:'Telegram outbox',requests:'HTTP-спостереження',capacity:'Покриття монітора',cursor:'Відставання cron-курсорів',unsent:'Не надіслано',pending:'Очікують обробки',oldest:'Найстаріше',live:'Живі сигнали',limit:'Ліміт',usage:'Використано',job:'Завдання',lag:'Не оброблено',status:'Статус',total:'Усього',retention:'Зберігання',days:'дн.',minutes:'хв',loading:'Завантаження SLO…',failed:'Не вдалося завантажити SLO',none:'Немає даних',windowNote:'Попередження враховує ковзне вікно й може зберігатися після вже усуненого збою.'},
    en:{title:'SLO and capacity',refresh:'Refresh SLO',healthy:'Healthy',warning:'Warning',collecting:'Collecting',source:'Source',success24:'Success 24h',success1:'Success 1h',p95:'p95',samples:'Observations',last:'Last',thresholds:'Thresholds',backpressure:'Queues and capacity',outbox:'Telegram outbox',requests:'HTTP observations',capacity:'Monitor coverage',cursor:'Cron cursor lag',unsent:'Unsent',pending:'Pending',oldest:'Oldest',live:'Live signals',limit:'Limit',usage:'Usage',job:'Job',lag:'Unprocessed',status:'Status',total:'Total',retention:'Retention',days:'days',minutes:'min',loading:'Loading SLO…',failed:'Could not load SLO',none:'No data',windowNote:'A warning uses a rolling window and may remain visible after the underlying fault has already recovered.'}
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let busy = false;
  let visible = false;
  let lastLoadedAt = 0;

  function addStyles(){
    if($('adminSloStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminSloStyles';
    style.textContent = '.slo-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.slo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px}.slo-card{background:var(--p2);border:1px solid var(--line);border-radius:9px;padding:11px;min-width:0}.slo-card h3{margin:0 0 8px;font-size:12px;overflow-wrap:anywhere}.slo-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid #ffffff0b}.slo-row:first-of-type{border-top:0}.slo-row span{color:var(--m)}.slo-badge{display:inline-flex;padding:3px 8px;border-radius:999px;border:1px solid var(--line);font-size:9px;text-transform:uppercase}.slo-badge.healthy{color:#9cf0ca;border-color:#0ecb8155}.slo-badge.warning{color:#ffc4cd;border-color:#f6465d55}.slo-badge.collecting{color:#ffe58f;border-color:#f0b90b55}.slo-panels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px}.slo-panel{background:var(--p);border:1px solid var(--line);border-radius:9px;padding:11px}.slo-table{overflow:auto;max-height:310px;margin-top:10px}.slo-table table{min-width:700px}.slo-note{color:var(--m);margin-top:9px}.slo-bad{color:#ffc4cd}.slo-good{color:#9cf0ca}@media(max-width:1050px){.slo-grid,.slo-panels{grid-template-columns:1fr 1fr}}@media(max-width:720px){.slo-grid,.slo-panels{grid-template-columns:1fr}.slo-head button{width:100%;min-height:42px}}';
    document.head.appendChild(style);
  }

  function ensure(){
    if($('operationalSlo')) return $('operationalSlo');
    const dashboard = $('dashboard');
    if(!dashboard) return null;
    addStyles();
    const section = document.createElement('section');
    section.id = 'operationalSlo';
    section.className = 'card';
    section.style.marginTop = '10px';
    section.innerHTML = `<div class="slo-head"><div><h2>${t.title}</h2><div id="sloGenerated" class="muted">—</div></div><button id="sloRefresh" class="gold">${t.refresh}</button></div><div id="sloBody" class="muted">${t.loading}</div>`;
    const incidents = $('operationalIncidents');
    if(incidents?.parentNode) incidents.insertAdjacentElement('afterend',section); else dashboard.prepend(section);
    $('sloRefresh').onclick = load;
    return section;
  }

  function badge(state){
    const safe = ['healthy','warning','collecting'].includes(state) ? state : 'collecting';
    return `<span class="slo-badge ${safe}">${esc(t[safe])}</span>`;
  }

  function age(value){return value == null ? '—' : `${n(value,1)} ${t.minutes}`;}
  function ms(value){return value == null ? '—' : `${n(value)} ms`;}
  function pct(value){return value == null ? '—' : `${n(value,2)}%`;}

  function render(data){
    const sources = Array.isArray(data?.sources) ? data.sources : [];
    const pressure = data?.backpressure || {};
    const outbox = pressure.outbox || {};
    const requests = pressure.operational_requests || {};
    const capacity = pressure.monitor_capacity || {};
    const cursors = Array.isArray(pressure.cursor_lag) ? pressure.cursor_lag : [];
    const retention = data?.retention || {};
    $('sloGenerated').textContent = data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—';

    const sourceCards = sources.length ? sources.map(item => {
      const thresholds = item.thresholds || {};
      return `<article class="slo-card"><div class="request-head"><h3>${esc(item.source_name || '—')}</h3>${badge(item.state)}</div><div class="muted">${esc(item.source_type || '—')}</div><div class="slo-row"><span>${t.success24}</span><b>${pct(item.success_pct_24h)}</b></div><div class="slo-row"><span>${t.success1}</span><b>${pct(item.success_pct_1h)}</b></div><div class="slo-row"><span>${t.p95}</span><b>${ms(item.p95_ms_24h)}</b></div><div class="slo-row"><span>${t.samples}</span><b>${n(item.samples_24h)}</b></div><div class="slo-row"><span>${t.last}</span><b>${age(item.age_minutes)}</b></div><div class="slo-note">${t.thresholds}: ≥${pct(thresholds.min_success_pct)} · p95 ≤ ${ms(thresholds.max_p95_ms)} · age ≤ ${age(thresholds.max_age_minutes)}</div></article>`;
    }).join('') : `<div class="muted">${t.none}</div>`;

    const pressureClass = value => value ? 'slo-bad' : 'slo-good';
    const cursorTable = cursors.length ? `<div class="slo-table"><table><thead><tr><th>${t.job}</th><th>${t.lag}</th><th>${t.oldest}</th><th>${t.status}</th></tr></thead><tbody>${cursors.map(item=>`<tr><td>${esc(item.source_name || '—')}</td><td>${n(item.pending_terminal_runs)}</td><td>${age(item.oldest_pending_minutes)}</td><td class="${pressureClass(item.warning)}">${item.warning ? t.warning : t.healthy}</td></tr>`).join('')}</tbody></table></div>` : `<div class="muted">${t.none}</div>`;

    $('sloBody').innerHTML = `<div class="slo-grid">${sourceCards}</div><div class="slo-panels"><div class="slo-panel"><h3>${t.outbox}</h3><div class="slo-row"><span>${t.total}</span><b>${n(outbox.total)}</b></div><div class="slo-row"><span>${t.unsent}</span><b class="${pressureClass(outbox.warning)}">${n(outbox.unsent)}</b></div><div class="slo-row"><span>${t.oldest}</span><b>${age(outbox.oldest_unsent_minutes)}</b></div></div><div class="slo-panel"><h3>${t.requests}</h3><div class="slo-row"><span>${t.total}</span><b>${n(requests.total)}</b></div><div class="slo-row"><span>${t.pending}</span><b class="${pressureClass(requests.warning)}">${n(requests.pending)}</b></div><div class="slo-row"><span>${t.oldest}</span><b>${age(requests.oldest_pending_minutes)}</b></div></div><div class="slo-panel"><h3>${t.capacity}</h3><div class="slo-row"><span>${t.live}</span><b>${n(capacity.live_signals)}</b></div><div class="slo-row"><span>${t.limit}</span><b>${n(capacity.hard_limit)}</b></div><div class="slo-row"><span>${t.usage}</span><b class="${pressureClass(capacity.warning)}">${pct(capacity.usage_pct)}</b></div></div></div><div class="slo-panel" style="margin-top:10px"><h3>${t.cursor}</h3>${cursorTable}</div><div class="slo-note">${t.retention}: HTTP ${n(retention.processed_http_days)} ${t.days} · observations ${n(retention.observations_days)} ${t.days} · incidents ${n(retention.resolved_incidents_days)} ${t.days} · outbox ${n(retention.outbox_sent_dead_days)} ${t.days}. ${t.windowNote}</div>`;
  }

  async function load(){
    if(busy || typeof sb === 'undefined') return;
    ensure();
    busy = true;
    $('sloRefresh').disabled = true;
    try{
      const {data,error} = await sb.rpc('get_crypto_admin_operational_slo');
      if(error) throw error;
      render(data || {});
      lastLoadedAt = Date.now();
    }catch(error){
      $('sloBody').innerHTML = `<div class="health-error">${esc(error?.message || t.failed)}</div>`;
    }finally{
      busy = false;
      $('sloRefresh').disabled = false;
    }
  }

  function boot(){
    const panel = ensure();
    if(!panel) return;
    const dashboard = $('dashboard');
    const nowVisible = !!dashboard && !dashboard.classList.contains('hide');
    if(nowVisible && (!visible || Date.now()-lastLoadedAt > 60000)) load();
    visible = nowVisible;
    const refresh = $('refresh');
    if(refresh && !refresh.dataset.sloHook){
      refresh.dataset.sloHook = '1';
      refresh.addEventListener('click',()=>setTimeout(load,0));
    }
  }

  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,5000);
  boot();
})();