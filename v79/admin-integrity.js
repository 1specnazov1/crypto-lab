'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num = value => Number(value || 0).toLocaleString('en-US');
  const labels = {
    ru:{title:'Целостность данных',refresh:'Проверить целостность',healthy:'Все инварианты соблюдены',warning:'Требуется наблюдение',critical:'Нарушение целостности',total:'Проверок',criticalChecks:'Критические',warningChecks:'Предупреждения',violations:'Активные нарушения',none:'Активных нарушений нет',all:'Все проверки',code:'Проверка',severity:'Уровень',count:'Нарушений',detail:'Условие',passed:'Норма',failed:'Нарушено',generated:'Сформировано',cutover:'Outbox cutover',loading:'Проверка целостности…',loadFailed:'Не удалось проверить целостность',note:'Критическое нарушение автоматически переводит операционное решение в NO-GO.'},
    uk:{title:'Цілісність даних',refresh:'Перевірити цілісність',healthy:'Усі інваріанти виконані',warning:'Потрібне спостереження',critical:'Порушення цілісності',total:'Перевірок',criticalChecks:'Критичні',warningChecks:'Попередження',violations:'Активні порушення',none:'Активних порушень немає',all:'Усі перевірки',code:'Перевірка',severity:'Рівень',count:'Порушень',detail:'Умова',passed:'Норма',failed:'Порушено',generated:'Сформовано',cutover:'Outbox cutover',loading:'Перевірка цілісності…',loadFailed:'Не вдалося перевірити цілісність',note:'Критичне порушення автоматично переводить операційне рішення в NO-GO.'},
    en:{title:'Data integrity',refresh:'Check integrity',healthy:'All invariants pass',warning:'Review required',critical:'Integrity violation',total:'Checks',criticalChecks:'Critical',warningChecks:'Warnings',violations:'Active violations',none:'No active violations',all:'All checks',code:'Check',severity:'Severity',count:'Violations',detail:'Condition',passed:'Pass',failed:'Failed',generated:'Generated',cutover:'Outbox cutover',loading:'Checking integrity…',loadFailed:'Could not check integrity',note:'A critical violation automatically changes the operational decision to NO-GO.'}
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let busy = false;
  let loadedAt = 0;
  let visible = false;

  function styles(){
    if($('adminIntegrityStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminIntegrityStyles';
    style.textContent = '.integrity-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.integrity-state{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--p2);margin-top:10px}.integrity-state strong{font-size:23px}.integrity-state.healthy strong{color:#9cf0ca}.integrity-state.warning strong{color:#ffe58f}.integrity-state.critical strong{color:#ffc4cd}.integrity-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.integrity-stat{padding:10px;background:var(--p2);border:1px solid var(--line);border-radius:8px}.integrity-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase}.integrity-stat b{display:block;font-size:19px;margin-top:5px}.integrity-list{display:grid;gap:7px;margin-top:9px}.integrity-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:start;padding:9px;background:var(--p2);border:1px solid var(--line);border-radius:8px}.integrity-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;background:#0ecb81}.integrity-dot.warning{background:#f0b90b}.integrity-dot.critical{background:#f6465d}.integrity-row small{display:block;color:var(--m);margin-top:3px;overflow-wrap:anywhere}.integrity-count{font-variant-numeric:tabular-nums;font-weight:900}.integrity-table{overflow:auto;max-height:430px}.integrity-table table{min-width:760px}.integrity-pass{color:#9cf0ca}.integrity-fail{color:#ffc4cd}.integrity-muted{color:var(--m);padding:10px 0}.integrity-error{color:#ffc4cd;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px;padding:10px}.integrity-note{color:var(--m);margin-top:9px;line-height:1.5}@media(max-width:760px){.integrity-stats{grid-template-columns:1fr}.integrity-state{grid-template-columns:1fr}.integrity-head button{width:100%;min-height:42px}.integrity-row{grid-template-columns:auto 1fr}.integrity-count{grid-column:2}}';
    document.head.appendChild(style);
  }

  function mount(){
    if($('dataIntegrityPanel')) return $('dataIntegrityPanel');
    const dashboard = $('dashboard');
    if(!dashboard) return null;
    styles();
    const section = document.createElement('section');
    section.id = 'dataIntegrityPanel';
    section.className = 'card';
    section.style.marginTop = '10px';
    section.innerHTML = `<div class="integrity-head"><div><h2>${t.title}</h2><div id="integrityGenerated" class="muted">—</div></div><button id="integrityRefresh" class="gold">${t.refresh}</button></div><div id="integrityBody" class="integrity-muted">${t.loading}</div>`;
    const summary = $('operationalSummary');
    if(summary?.parentNode) summary.insertAdjacentElement('afterend',section); else dashboard.prepend(section);
    $('integrityRefresh').onclick = load;
    return section;
  }

  function stateLabel(state){return t[state] || state || '—';}
  function render(data){
    const state = String(data?.state || 'critical');
    const checks = Array.isArray(data?.checks) ? data.checks : [];
    const violations = Array.isArray(data?.violations) ? data.violations : [];
    $('integrityGenerated').textContent = `${t.generated}: ${data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'} · ${t.cutover}: ${data?.cutover_at ? new Date(data.cutover_at).toLocaleString() : '—'}`;
    const violationHtml = violations.length ? violations.map(item => `<div class="integrity-row"><span class="integrity-dot ${esc(item.severity)}"></span><div><b>${esc(item.code)}</b><small>${esc(item.detail)}</small></div><span class="integrity-count">${num(item.violations)}</span></div>`).join('') : `<div class="integrity-muted">✓ ${t.none}</div>`;
    const rows = checks.map(item => `<tr><td><b>${esc(item.code)}</b></td><td>${esc(item.severity)}</td><td class="${item.passed ? 'integrity-pass' : 'integrity-fail'}">${item.passed ? t.passed : t.failed}</td><td>${num(item.violations)}</td><td>${esc(item.detail)}</td></tr>`).join('');
    $('integrityBody').innerHTML = `
      <div class="integrity-state ${esc(state)}"><strong>${esc(stateLabel(state))}</strong><div><b>${num(data?.total_checks)} ${t.total.toLowerCase()}</b><div class="integrity-note">${t.note}</div></div></div>
      <div class="integrity-stats"><div class="integrity-stat"><span>${t.total}</span><b>${num(data?.total_checks)}</b></div><div class="integrity-stat"><span>${t.criticalChecks}</span><b>${num(data?.critical_checks)}</b></div><div class="integrity-stat"><span>${t.warningChecks}</span><b>${num(data?.warning_checks)}</b></div></div>
      <h3 style="margin-top:14px">${t.violations}</h3><div class="integrity-list">${violationHtml}</div>
      <details style="margin-top:12px"><summary>${t.all} (${num(checks.length)})</summary><div class="integrity-table"><table><thead><tr><th>${t.code}</th><th>${t.severity}</th><th>State</th><th>${t.count}</th><th>${t.detail}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }

  async function load(){
    if(busy || typeof sb === 'undefined') return;
    mount();
    busy = true;
    const button = $('integrityRefresh');
    if(button) button.disabled = true;
    try{
      const {data,error} = await sb.rpc('get_crypto_admin_data_integrity');
      if(error) throw error;
      render(data || {});
      loadedAt = Date.now();
    }catch(error){
      $('integrityBody').innerHTML = `<div class="integrity-error">${esc(error?.message || t.loadFailed)}</div>`;
    }finally{
      busy = false;
      if(button) button.disabled = false;
    }
  }

  function boot(){
    const panel = mount();
    if(!panel) return;
    const dashboard = $('dashboard');
    const nowVisible = !!dashboard && !dashboard.classList.contains('hide');
    if(nowVisible && (!visible || Date.now()-loadedAt>60000)) load();
    visible = nowVisible;
    const common = $('refresh');
    if(common && !common.dataset.integrityHook){
      common.dataset.integrityHook='1';
      common.addEventListener('click',()=>setTimeout(load,0));
    }
  }

  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(boot,5000);
  boot();
})();
