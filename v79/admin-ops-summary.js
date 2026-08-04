'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (value, digits = 0) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const labels = {
    ru:{title:'Операционное решение',refresh:'Обновить сводку',healthy:'Норма',warning:'Наблюдение',critical:'Стоп',collecting:'Сбор данных',TECHNICAL_GO:'Технический GO',WATCH:'WATCH',NO_GO:'NO-GO',generated:'Сформировано',next:'Следующая проверка',minutes:'мин',alerts:'Активные предупреждения',noAlerts:'Технических предупреждений нет',indicators:'Контуры',owner:'Ответственный',external:'Внешние блокеры запуска',notifications:'Внешние уведомления отключены',loading:'Загрузка операционной сводки…',failed:'Не удалось загрузить сводку',operations:'Эксплуатация',security:'Безопасность',business:'Бизнес',release:'Релиз',business_legal:'Бизнес / право',codes:{signal_monitor:'Монитор сигналов',market_scanner:'Рыночный сканер',incident_reconciliation:'Сверка инцидентов',open_incidents:'Открытые инциденты',telegram_outbox:'Telegram outbox',operational_http_backlog:'HTTP backlog',cron_cursor_lag:'Отставание cron',cron_terminal_state:'Состояние cron',maintenance_freshness:'Обслуживание',security_boundary:'Граница безопасности'}},
    uk:{title:'Операційне рішення',refresh:'Оновити зведення',healthy:'Норма',warning:'Спостереження',critical:'Стоп',collecting:'Збір даних',TECHNICAL_GO:'Технічний GO',WATCH:'WATCH',NO_GO:'NO-GO',generated:'Сформовано',next:'Наступна перевірка',minutes:'хв',alerts:'Активні попередження',noAlerts:'Технічних попереджень немає',indicators:'Контури',owner:'Відповідальний',external:'Зовнішні блокери запуску',notifications:'Зовнішні сповіщення вимкнено',loading:'Завантаження операційного зведення…',failed:'Не вдалося завантажити зведення',operations:'Експлуатація',security:'Безпека',business:'Бізнес',release:'Реліз',business_legal:'Бізнес / право',codes:{signal_monitor:'Монітор сигналів',market_scanner:'Ринковий сканер',incident_reconciliation:'Звірка інцидентів',open_incidents:'Відкриті інциденти',telegram_outbox:'Telegram outbox',operational_http_backlog:'HTTP backlog',cron_cursor_lag:'Відставання cron',cron_terminal_state:'Стан cron',maintenance_freshness:'Обслуговування',security_boundary:'Межа безпеки'}},
    en:{title:'Operational decision',refresh:'Refresh summary',healthy:'Healthy',warning:'Watch',critical:'Stop',collecting:'Collecting',TECHNICAL_GO:'Technical GO',WATCH:'WATCH',NO_GO:'NO-GO',generated:'Generated',next:'Next review',minutes:'min',alerts:'Active warnings',noAlerts:'No technical warnings',indicators:'Controls',owner:'Owner',external:'External launch blockers',notifications:'External notifications are disabled',loading:'Loading operational summary…',failed:'Could not load summary',operations:'Operations',security:'Security',business:'Business',release:'Release',business_legal:'Business / legal',codes:{signal_monitor:'Signal monitor',market_scanner:'Market scanner',incident_reconciliation:'Incident reconciliation',open_incidents:'Open incidents',telegram_outbox:'Telegram outbox',operational_http_backlog:'HTTP backlog',cron_cursor_lag:'Cron cursor lag',cron_terminal_state:'Cron terminal state',maintenance_freshness:'Maintenance',security_boundary:'Security boundary'}}
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let busy = false;
  let loadedAt = 0;
  let visible = false;

  function styles(){
    if($('opsSummaryStyles')) return;
    const style=document.createElement('style');
    style.id='opsSummaryStyles';
    style.textContent='.ops-summary-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ops-decision{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--p2);margin-top:10px}.ops-decision strong{font-size:26px}.ops-decision.healthy strong{color:#9cf0ca}.ops-decision.warning strong,.ops-decision.collecting strong{color:#ffe58f}.ops-decision.critical strong{color:#ffc4cd}.ops-counts{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.ops-chip{display:inline-flex;gap:5px;align-items:center;padding:4px 8px;border:1px solid var(--line);border-radius:999px;font-size:10px}.ops-chip.healthy{color:#9cf0ca}.ops-chip.warning,.ops-chip.collecting{color:#ffe58f}.ops-chip.critical{color:#ffc4cd}.ops-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.ops-panel{border:1px solid var(--line);border-radius:10px;background:var(--p);padding:12px;min-width:0}.ops-list{display:grid;gap:7px}.ops-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:start;border:1px solid var(--line);background:var(--p2);border-radius:8px;padding:9px}.ops-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;background:#657080}.ops-dot.healthy{background:#0ecb81}.ops-dot.warning,.ops-dot.collecting{background:#f0b90b}.ops-dot.critical{background:#f6465d}.ops-row small{display:block;color:var(--m);margin-top:3px;line-height:1.4;overflow-wrap:anywhere}.ops-owner{font-size:9px;color:var(--m);white-space:nowrap}.ops-blocker{padding:8px;border:1px solid #f0b90b35;background:#f0b90b0b;border-radius:8px}.ops-blocker small{display:block;color:var(--m);margin-top:3px}.ops-muted{color:var(--m);padding:10px 0}.ops-error{color:#ffc4cd;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px;padding:10px}@media(max-width:900px){.ops-grid{grid-template-columns:1fr}}@media(max-width:520px){.ops-decision{grid-template-columns:1fr}.ops-summary-head button{width:100%;min-height:42px}.ops-row{grid-template-columns:auto 1fr}.ops-owner{grid-column:2}}';
    document.head.appendChild(style);
  }

  function mount(){
    if($('operationalSummary')) return $('operationalSummary');
    const dashboard=$('dashboard');
    if(!dashboard) return null;
    styles();
    const section=document.createElement('section');
    section.id='operationalSummary';
    section.className='card';
    section.style.marginTop='10px';
    section.innerHTML=`<div class="ops-summary-head"><div><h2>${t.title}</h2><div id="opsSummaryGenerated" class="muted">—</div></div><button id="opsSummaryRefresh" class="gold">${t.refresh}</button></div><div id="opsSummaryBody" class="ops-muted">${t.loading}</div>`;
    dashboard.prepend(section);
    $('opsSummaryRefresh').onclick=load;
    return section;
  }

  function owner(value){return t[value] || value || '—';}
  function stateLabel(value){return t[value] || value || '—';}
  function codeLabel(value){return t.codes[value] || value || '—';}

  function metricText(item){
    const m=item?.metrics||{};
    switch(item?.code){
      case 'signal_monitor':
      case 'market_scanner':
      case 'incident_reconciliation':
        return `${m.success_pct_24h==null?'—':num(m.success_pct_24h,2)}% · p95 ${m.p95_ms==null?'—':num(m.p95_ms,1)} ms · ${m.age_minutes==null?'—':num(m.age_minutes,1)} ${t.minutes} · fail 1h ${num(m.failures_1h)}`;
      case 'open_incidents': return `open ${num(m.open)} · high ${num(m.high_open)} · resolved 24h ${num(m.resolved_24h)}`;
      case 'telegram_outbox': return `sent ${num(m.sent)} · unsent ${num(m.unsent)} · dead ${num(m.dead)}`;
      case 'operational_http_backlog': return `pending ${num(m.pending)} · oldest ${m.oldest_pending_minutes==null?'—':num(m.oldest_pending_minutes,1)+' '+t.minutes}`;
      case 'cron_cursor_lag': return `sources ${num(m.lagging_sources)} · max ${num(m.max_pending_runs)} · oldest ${m.oldest_pending_minutes==null?'—':num(m.oldest_pending_minutes,1)+' '+t.minutes}`;
      case 'cron_terminal_state': return `success ${num(m.succeeded)}/${num(m.expected)} · failed ${num(m.failed)} · missing ${num(m.missing)}`;
      case 'maintenance_freshness': return `${m.status||'—'} · ${m.age_hours==null?'—':num(m.age_hours,1)+' h'}`;
      case 'security_boundary': return `RLS gaps ${num(m.tables_without_rls)} · public definers ${num(m.browser_public_definers)}`;
      default: return Object.entries(m).slice(0,4).map(([key,value])=>`${key}: ${value}`).join(' · ');
    }
  }

  function row(item){
    const state=String(item?.state||'healthy');
    return `<div class="ops-row"><span class="ops-dot ${esc(state)}"></span><div><b>${esc(codeLabel(item?.code))}</b><small>${esc(metricText(item))}</small></div><span class="ops-owner">${esc(owner(item?.owner))}</span></div>`;
  }

  function render(data){
    const indicators=Array.isArray(data?.indicators)?data.indicators:[];
    const alerts=Array.isArray(data?.alerts)?data.alerts:[];
    const blockers=Array.isArray(data?.release?.external_blockers)?data.release.external_blockers:[];
    const state=String(data?.overall_state||'collecting');
    const counts=data?.counts||{};
    $('opsSummaryGenerated').textContent=`${t.generated}: ${data?.generated_at?new Date(data.generated_at).toLocaleString():'—'}`;
    const alertHtml=alerts.length?alerts.map(row).join(''):`<div class="ops-muted">✓ ${t.noAlerts}</div>`;
    const blockerHtml=blockers.length?blockers.map(item=>`<div class="ops-blocker"><b>${esc(item.code||'—')}</b><small>${t.owner}: ${esc(owner(item.owner))}</small></div>`).join(''):`<div class="ops-muted">✓ ${t.noAlerts}</div>`;
    $('opsSummaryBody').innerHTML=`
      <div class="ops-decision ${esc(state)}"><strong>${esc(stateLabel(data?.decision))}</strong><div><b>${esc(stateLabel(state))}</b><small>${t.next}: ${num(data?.next_review_minutes||5)} ${t.minutes} · ${t.notifications}</small><div class="ops-counts"><span class="ops-chip healthy">${t.healthy} ${num(counts.healthy)}</span><span class="ops-chip warning">${t.warning} ${num(counts.warning)}</span><span class="ops-chip critical">${t.critical} ${num(counts.critical)}</span><span class="ops-chip collecting">${t.collecting} ${num(counts.collecting)}</span></div></div></div>
      <div class="ops-grid"><div class="ops-panel"><h3>${t.alerts}</h3><div class="ops-list">${alertHtml}</div></div><div class="ops-panel"><h3>${t.external}</h3><div class="ops-list">${blockerHtml}</div></div></div>
      <div class="ops-panel" style="margin-top:10px"><h3>${t.indicators}</h3><div class="ops-list">${indicators.map(row).join('')||`<div class="ops-muted">${t.loading}</div>`}</div></div>`;
  }

  async function load(){
    if(busy||typeof sb==='undefined') return;
    mount();
    busy=true;
    const button=$('opsSummaryRefresh');
    if(button) button.disabled=true;
    try{
      const {data,error}=await sb.rpc('get_crypto_admin_operational_summary');
      if(error) throw error;
      render(data||{});
      loadedAt=Date.now();
    }catch(error){
      $('opsSummaryBody').innerHTML=`<div class="ops-error">${esc(error?.message||t.failed)}</div>`;
    }finally{
      busy=false;
      if(button) button.disabled=false;
    }
  }

  function boot(){
    const section=mount();
    if(!section) return;
    const dashboard=$('dashboard');
    const nowVisible=!!dashboard&&!dashboard.classList.contains('hide');
    if(nowVisible&&(!visible||Date.now()-loadedAt>60000)) load();
    visible=nowVisible;
    const refresh=$('refresh');
    if(refresh&&!refresh.dataset.opsSummaryHook){
      refresh.dataset.opsSummaryHook='1';
      refresh.addEventListener('click',()=>setTimeout(load,0));
    }
  }

  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,10000);
  boot();
})();