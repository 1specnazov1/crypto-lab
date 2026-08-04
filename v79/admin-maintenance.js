'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>Number(value||0).toLocaleString('en-US');
  const labels={
    ru:{title:'Доказательство обслуживания',refresh:'Проверить обслуживание',healthy:'Готово / ожидается по плану',collecting:'Проверка выполняется',warning:'Требуется внимание',critical:'Обслуживание не подтверждено',expected:'Плановый запуск',run:'Запуск',seal:'Evidence seal',status:'Статус',started:'Начат',completed:'Завершён',error:'Ошибка',none:'Пока не создан',hash:'SHA-256 доказательства',counters:'Счётчики обслуживания',loading:'Проверка maintenance evidence…',failed:'Не удалось получить maintenance evidence',note:'До планового времени отсутствие seal является нормальным. После запуска failed или просроченный seal автоматически переводит решение в NO-GO.'},
    uk:{title:'Доказ обслуговування',refresh:'Перевірити обслуговування',healthy:'Готово / очікується за планом',collecting:'Перевірка виконується',warning:'Потрібна увага',critical:'Обслуговування не підтверджено',expected:'Плановий запуск',run:'Запуск',seal:'Evidence seal',status:'Статус',started:'Розпочато',completed:'Завершено',error:'Помилка',none:'Ще не створено',hash:'SHA-256 доказу',counters:'Лічильники обслуговування',loading:'Перевірка maintenance evidence…',failed:'Не вдалося отримати maintenance evidence',note:'До планового часу відсутність seal є нормальною. Після запуску failed або прострочений seal автоматично переводить рішення в NO-GO.'},
    en:{title:'Maintenance evidence',refresh:'Check maintenance',healthy:'Ready / scheduled',collecting:'Verification in progress',warning:'Review required',critical:'Maintenance not verified',expected:'Scheduled run',run:'Run',seal:'Evidence seal',status:'Status',started:'Started',completed:'Completed',error:'Error',none:'Not created yet',hash:'Evidence SHA-256',counters:'Maintenance counters',loading:'Checking maintenance evidence…',failed:'Could not load maintenance evidence',note:'Before the scheduled time, a missing seal is expected. After the run, a failed or overdue seal automatically changes the decision to NO-GO.'}
  };
  const lang=localStorage.getItem('cryptoLabLanguage')||'ru';
  const t=labels[lang]||labels.ru;
  let busy=false,loadedAt=0,visible=false;

  function styles(){
    if($('adminMaintenanceEvidenceStyles'))return;
    const style=document.createElement('style');
    style.id='adminMaintenanceEvidenceStyles';
    style.textContent='.maintenance-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.maintenance-state{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--p2)}.maintenance-state strong{font-size:21px}.maintenance-state.healthy strong{color:#9cf0ca}.maintenance-state.collecting strong,.maintenance-state.warning strong{color:#ffe58f}.maintenance-state.critical strong{color:#ffc4cd}.maintenance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.maintenance-card{padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--p2);min-width:0}.maintenance-card span{display:block;color:var(--m);font-size:9px;text-transform:uppercase}.maintenance-card b,.maintenance-card code{display:block;margin-top:5px;overflow-wrap:anywhere}.maintenance-counters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.maintenance-counter{padding:8px;border:1px solid var(--line);border-radius:7px;background:var(--p2)}.maintenance-counter span{display:block;color:var(--m);font-size:9px;overflow-wrap:anywhere}.maintenance-counter b{display:block;margin-top:4px}.maintenance-note{color:var(--m);line-height:1.5;margin-top:9px}.maintenance-error{color:#ffc4cd;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px;padding:10px}@media(max-width:760px){.maintenance-grid,.maintenance-counters{grid-template-columns:1fr}.maintenance-head button{width:100%;min-height:42px}}';
    document.head.appendChild(style);
  }

  function mount(){
    if($('maintenanceEvidencePanel'))return $('maintenanceEvidencePanel');
    const dashboard=$('dashboard');if(!dashboard)return null;
    styles();
    const section=document.createElement('section');
    section.id='maintenanceEvidencePanel';section.className='card';section.style.marginTop='10px';
    section.innerHTML=`<div class="maintenance-head"><div><h2>${t.title}</h2><div id="maintenanceEvidenceGenerated" class="muted">—</div></div><button id="maintenanceEvidenceRefresh" class="gold">${t.refresh}</button></div><div id="maintenanceEvidenceBody" class="maintenance-note">${t.loading}</div>`;
    const anchor=$('releaseDriftPanel')||$('dataIntegrityPanel')||$('operationalSummary');
    if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',section);else dashboard.prepend(section);
    $('maintenanceEvidenceRefresh').onclick=load;
    return section;
  }

  const stateText=state=>t[state]||state||'—';
  const date=value=>value?new Date(value).toLocaleString():'—';
  function render(data){
    const state=String(data?.state||'critical');
    const run=data?.maintenance_run||null,seal=data?.seal||null;
    const counters=run?.counters&&typeof run.counters==='object'?run.counters:{};
    const counterHtml=Object.entries(counters).map(([key,value])=>`<div class="maintenance-counter"><span>${esc(key)}</span><b>${num(value)}</b></div>`).join('')||`<div class="maintenance-note">${t.none}</div>`;
    $('maintenanceEvidenceGenerated').textContent=`${t.expected}: ${date(data?.expected_after)} · ${date(data?.generated_at)}`;
    $('maintenanceEvidenceBody').innerHTML=`
      <div class="maintenance-state ${esc(state)}"><strong>${esc(stateText(state))}</strong><div class="maintenance-note">${t.note}</div></div>
      <div class="maintenance-grid">
        <div class="maintenance-card"><span>${t.run}</span><b>${run?`#${esc(run.id)} · ${esc(run.status)}`:t.none}</b><small>${t.started}: ${date(run?.started_at)}<br>${t.completed}: ${date(run?.completed_at)}<br>${t.error}: ${run?.has_error?'YES':'NO'}</small></div>
        <div class="maintenance-card"><span>${t.seal}</span><b>${seal?`#${esc(seal.id)} · ${esc(seal.status)}`:t.none}</b><span>${t.hash}</span><code>${seal?.evidence_hash?esc(seal.evidence_hash):'—'}</code></div>
      </div>
      <h3 style="margin-top:14px">${t.counters}</h3><div class="maintenance-counters">${counterHtml}</div>`;
  }

  async function load(){
    if(busy||typeof sb==='undefined')return;
    mount();busy=true;const button=$('maintenanceEvidenceRefresh');if(button)button.disabled=true;
    try{const {data,error}=await sb.rpc('get_crypto_admin_maintenance_evidence');if(error)throw error;render(data||{});loadedAt=Date.now();}
    catch(error){$('maintenanceEvidenceBody').innerHTML=`<div class="maintenance-error">${esc(error?.message||t.failed)}</div>`;}
    finally{busy=false;if(button)button.disabled=false;}
  }

  function boot(){
    const panel=mount();if(!panel)return;
    const dashboard=$('dashboard');const nowVisible=!!dashboard&&!dashboard.classList.contains('hide');
    if(nowVisible&&(!visible||Date.now()-loadedAt>60000))load();visible=nowVisible;
    const common=$('refresh');if(common&&!common.dataset.maintenanceEvidenceHook){common.dataset.maintenanceEvidenceHook='1';common.addEventListener('click',()=>setTimeout(load,0));}
  }
  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,5000);boot();
})();
