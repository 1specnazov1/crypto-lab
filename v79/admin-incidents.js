'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value || 0).toLocaleString('en-US');
  const when = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)) : '—';
  const labels = {
    ru:{title:'Эксплуатационные инциденты',refresh:'Обновить инциденты',open:'Открыты',resolved:'Восстановлены',edge:'Edge',cron:'Cron',critical:'Критические',oldest:'Старейший открытый',none:'Инцидентов нет',source:'Источник',status:'Статус',severity:'Риск',occurrences:'Повторы',first:'Первый раз',last:'Последний раз',code:'HTTP',error:'Последняя ошибка',resolution:'Восстановление',loading:'Загрузка журнала инцидентов…',failed:'Не удалось загрузить журнал инцидентов',minutes:'мин'},
    uk:{title:'Експлуатаційні інциденти',refresh:'Оновити інциденти',open:'Відкриті',resolved:'Відновлені',edge:'Edge',cron:'Cron',critical:'Критичні',oldest:'Найстаріший відкритий',none:'Інцидентів немає',source:'Джерело',status:'Статус',severity:'Ризик',occurrences:'Повтори',first:'Перший раз',last:'Останній раз',code:'HTTP',error:'Остання помилка',resolution:'Відновлення',loading:'Завантаження журналу інцидентів…',failed:'Не вдалося завантажити журнал інцидентів',minutes:'хв'},
    en:{title:'Operational incidents',refresh:'Refresh incidents',open:'Open',resolved:'Recovered',edge:'Edge',cron:'Cron',critical:'Critical',oldest:'Oldest open',none:'No incidents',source:'Source',status:'Status',severity:'Risk',occurrences:'Occurrences',first:'First seen',last:'Last seen',code:'HTTP',error:'Last error',resolution:'Recovery',loading:'Loading incident ledger…',failed:'Could not load incident ledger',minutes:'min'}
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let busy = false;
  let visible = false;
  let lastLoadedAt = 0;

  function addStyles(){
    if($('adminIncidentStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminIncidentStyles';
    style.textContent = '.incident-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.incident-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}.incident-stat{background:var(--p2);border:1px solid var(--line);border-radius:8px;padding:10px}.incident-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase}.incident-stat b{display:block;font-size:18px;margin-top:5px}.incident-table{overflow:auto;max-height:360px}.incident-table table{min-width:980px}.incident-badge{display:inline-flex;padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:9px}.incident-badge.open,.incident-badge.high,.incident-badge.critical{color:#ffc4cd;border-color:#f6465d55}.incident-badge.resolved,.incident-badge.low{color:#9cf0ca;border-color:#0ecb8155}.incident-badge.medium{color:#ffe58f;border-color:#f0b90b55}.incident-error{display:block;max-width:300px;white-space:normal;overflow-wrap:anywhere;color:#ffc4cd}.incident-muted{color:var(--m);padding:12px 0}@media(max-width:900px){.incident-stats{grid-template-columns:1fr 1fr}}@media(max-width:480px){.incident-stats{grid-template-columns:1fr}.incident-head button{width:100%;min-height:42px}}';
    document.head.appendChild(style);
  }

  function ensure(){
    if($('operationalIncidents')) return $('operationalIncidents');
    const dashboard = $('dashboard');
    if(!dashboard) return null;
    addStyles();
    const section = document.createElement('section');
    section.id = 'operationalIncidents';
    section.className = 'card';
    section.style.marginTop = '10px';
    section.innerHTML = `<div class="incident-head"><div><h2>${t.title}</h2><div id="incidentGenerated" class="muted">—</div></div><button id="incidentRefresh" class="gold">${t.refresh}</button></div><div id="incidentBody" class="incident-muted">${t.loading}</div>`;
    const health = $('operationalHealth');
    if(health?.parentNode) health.insertAdjacentElement('afterend',section); else dashboard.prepend(section);
    $('incidentRefresh').onclick = load;
    return section;
  }

  function badge(value){
    const safe = String(value || 'unknown').toLowerCase().replace(/[^a-z_]/g,'');
    return `<span class="incident-badge ${safe}">${esc(value || '—')}</span>`;
  }

  function render(data){
    const counts = data?.counts || {};
    const rows = Array.isArray(data?.recent) ? data.recent : [];
    $('incidentGenerated').textContent = data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—';
    const table = rows.length ? `<div class="incident-table"><table><thead><tr><th>${t.source}</th><th>${t.status}</th><th>${t.severity}</th><th>${t.occurrences}</th><th>${t.first}</th><th>${t.last}</th><th>${t.code}</th><th>${t.error}</th><th>${t.resolution}</th></tr></thead><tbody>${rows.map(item=>`<tr><td><b>${esc(item.source_name || '—')}</b><div class="muted">${esc(item.source_type || '—')}</div></td><td>${badge(item.status)}</td><td>${badge(item.severity)}</td><td>${number(item.occurrences)}</td><td>${when(item.first_seen_at)}</td><td>${when(item.last_seen_at)}</td><td>${item.last_status_code == null ? '—' : esc(item.last_status_code)}</td><td><span class="incident-error">${esc(item.last_error || '—')}</span></td><td><span class="muted">${esc(item.resolution_note || '—')}</span><div>${when(item.resolved_at)}</div></td></tr>`).join('')}</tbody></table></div>` : `<div class="incident-muted">${t.none}</div>`;
    $('incidentBody').innerHTML = `<div class="incident-stats"><div class="incident-stat"><span>${t.open}</span><b>${number(counts.open)}</b></div><div class="incident-stat"><span>${t.resolved}</span><b>${number(counts.resolved)}</b></div><div class="incident-stat"><span>${t.edge}</span><b>${number(counts.edge_open)}</b></div><div class="incident-stat"><span>${t.cron}</span><b>${number(counts.cron_open)}</b></div><div class="incident-stat"><span>${t.oldest}</span><b>${data?.oldest_open_minutes == null ? '—' : `${Number(data.oldest_open_minutes).toFixed(1)} ${t.minutes}`}</b></div></div>${table}`;
  }

  async function load(){
    if(busy || typeof sb === 'undefined') return;
    ensure();
    busy = true;
    $('incidentRefresh').disabled = true;
    try{
      const {data,error} = await sb.rpc('get_crypto_admin_operational_incidents');
      if(error) throw error;
      render(data || {});
      lastLoadedAt = Date.now();
    }catch(error){
      $('incidentBody').innerHTML = `<div class="health-error">${esc(error?.message || t.failed)}</div>`;
    }finally{
      busy = false;
      $('incidentRefresh').disabled = false;
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
    if(refresh && !refresh.dataset.incidentHook){
      refresh.dataset.incidentHook = '1';
      refresh.addEventListener('click',()=>setTimeout(load,0));
    }
  }

  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,5000);
  boot();
})();