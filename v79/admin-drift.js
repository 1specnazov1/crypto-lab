'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={
    ru:{title:'Дрейф релиза и откат',refresh:'Проверить релиз',healthy:'Согласовано',warning:'Требует проверки',critical:'Обнаружен дрейф',checks:'Контрольные проверки',violations:'Расхождения',none:'Расхождений нет',rollback:'Готовность отката',metadata:'Только metadata',target:'Цель отката',rehearsed:'Проверено',loading:'Проверка Supabase, Edge и PWA…',failed:'Не удалось проверить релиз',note:'Критический дрейф автоматически переводит операционное решение в NO-GO.'},
    uk:{title:'Дрейф релізу та відкат',refresh:'Перевірити реліз',healthy:'Узгоджено',warning:'Потрібна перевірка',critical:'Виявлено дрейф',checks:'Контрольні перевірки',violations:'Розбіжності',none:'Розбіжностей немає',rollback:'Готовність відкату',metadata:'Лише metadata',target:'Ціль відкату',rehearsed:'Перевірено',loading:'Перевірка Supabase, Edge та PWA…',failed:'Не вдалося перевірити реліз',note:'Критичний дрейф автоматично переводить операційне рішення в NO-GO.'},
    en:{title:'Release drift and rollback',refresh:'Check release',healthy:'Aligned',warning:'Review required',critical:'Drift detected',checks:'Control checks',violations:'Mismatches',none:'No mismatches',rollback:'Rollback readiness',metadata:'Metadata only',target:'Rollback target',rehearsed:'Rehearsed',loading:'Checking Supabase, Edge and PWA…',failed:'Could not check release',note:'Critical drift automatically changes the operational decision to NO-GO.'}
  };
  const lang=localStorage.getItem('cryptoLabLanguage')||'ru';
  const t=labels[lang]||labels.ru;
  let busy=false,loadedAt=0,visible=false;

  function styles(){
    if($('adminDriftStyles'))return;
    const style=document.createElement('style');style.id='adminDriftStyles';
    style.textContent='.drift-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.drift-state{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--p2);margin-top:10px}.drift-state strong{font-size:23px}.drift-state.healthy strong{color:#9cf0ca}.drift-state.warning strong{color:#ffe58f}.drift-state.critical strong{color:#ffc4cd}.drift-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.drift-panel{padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--p)}.drift-list{display:grid;gap:7px}.drift-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--p2)}.drift-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;background:#0ecb81}.drift-dot.warning{background:#f0b90b}.drift-dot.critical{background:#f6465d}.drift-row small{display:block;color:var(--m);margin-top:3px;overflow-wrap:anywhere}.drift-status{font-weight:900}.drift-muted{color:var(--m);padding:10px 0}.drift-error{color:#ffc4cd;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px;padding:10px}.drift-note{color:var(--m);line-height:1.5;margin-top:8px}@media(max-width:900px){.drift-grid{grid-template-columns:1fr}}@media(max-width:520px){.drift-head button{width:100%;min-height:42px}.drift-state{grid-template-columns:1fr}.drift-row{grid-template-columns:auto 1fr}.drift-status{grid-column:2}}';
    document.head.appendChild(style);
  }
  function mount(){
    if($('releaseDriftPanel'))return $('releaseDriftPanel');
    const dashboard=$('dashboard');if(!dashboard)return null;styles();
    const section=document.createElement('section');section.id='releaseDriftPanel';section.className='card';section.style.marginTop='10px';
    section.innerHTML=`<div class="drift-head"><div><h2>${t.title}</h2><div id="driftGenerated" class="muted">—</div></div><button id="driftRefresh" class="gold">${t.refresh}</button></div><div id="driftBody" class="drift-muted">${t.loading}</div>`;
    const integrity=$('dataIntegrityPanel');if(integrity?.parentNode)integrity.insertAdjacentElement('afterend',section);else dashboard.prepend(section);
    $('driftRefresh').onclick=load;return section;
  }
  const stateLabel=state=>t[state]||state||'—';
  function row(item){const state=item?.passed?'healthy':String(item?.severity||'critical');return `<div class="drift-row"><span class="drift-dot ${esc(state)}"></span><div><b>${esc(item?.code||'—')}</b><small>${esc(item?.detail||'')}</small></div><span class="drift-status">${item?.passed?'✓':'!'}</span></div>`;}
  function render(drift,rollback){
    const state=String(drift?.state||'critical');const checks=Array.isArray(drift?.checks)?drift.checks:[];const violations=Array.isArray(drift?.violations)?drift.violations:[];
    $('driftGenerated').textContent=`${drift?.manifest_key||'—'} · ${drift?.generated_at?new Date(drift.generated_at).toLocaleString():'—'}`;
    const violationHtml=violations.length?violations.map(item=>row({...item,passed:false})).join(''):`<div class="drift-muted">✓ ${t.none}</div>`;
    const checkHtml=checks.map(row).join('');
    const rollbackChecks=Array.isArray(rollback?.checks)?rollback.checks:[];
    $('driftBody').innerHTML=`
      <div class="drift-state ${esc(state)}"><strong>${esc(stateLabel(state))}</strong><div><b>${Number(drift?.total_checks||0)} ${t.checks.toLowerCase()}</b><div class="drift-note">${t.note}</div></div></div>
      <div class="drift-grid"><div class="drift-panel"><h3>${t.violations}</h3><div class="drift-list">${violationHtml}</div></div><div class="drift-panel"><h3>${t.rollback}</h3><div class="drift-list"><div class="drift-row"><span class="drift-dot ${rollback?.state==='healthy'?'healthy':esc(rollback?.state||'warning')}"></span><div><b>${esc(rollback?.result||rollback?.state||'—')}</b><small>${t.metadata}: ${rollback?.metadata_only===true?'yes':'no'} · ${t.target}: ${esc(rollback?.rollback_target_sha||'—')} · ${t.rehearsed}: ${rollback?.rehearsed_at?new Date(rollback.rehearsed_at).toLocaleString():'—'}</small></div><span class="drift-status">${rollback?.state==='healthy'?'✓':'!'}</span></div>${rollbackChecks.map(item=>row({code:item.code,detail:item.detail,passed:item.passed,severity:'critical'})).join('')}</div></div></div>
      <details style="margin-top:12px"><summary>${t.checks} (${checks.length})</summary><div class="drift-list" style="margin-top:8px">${checkHtml}</div></details>`;
  }
  async function load(){
    if(busy||typeof sb==='undefined')return;mount();busy=true;const button=$('driftRefresh');if(button)button.disabled=true;
    try{const [d,r]=await Promise.all([sb.rpc('get_crypto_admin_release_drift'),sb.rpc('get_crypto_admin_rollback_readiness')]);if(d.error)throw d.error;if(r.error)throw r.error;render(d.data||{},r.data||{});loadedAt=Date.now();}
    catch(error){$('driftBody').innerHTML=`<div class="drift-error">${esc(error?.message||t.failed)}</div>`;}
    finally{busy=false;if(button)button.disabled=false;}
  }
  function boot(){const panel=mount();if(!panel)return;const dashboard=$('dashboard');const nowVisible=!!dashboard&&!dashboard.classList.contains('hide');if(nowVisible&&(!visible||Date.now()-loadedAt>60000))load();visible=nowVisible;const common=$('refresh');if(common&&!common.dataset.driftHook){common.dataset.driftHook='1';common.addEventListener('click',()=>setTimeout(load,0));}}
  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});setInterval(boot,5000);boot();
})();
