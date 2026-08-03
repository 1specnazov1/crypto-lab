'use strict';
(() => {
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-admin-deletions';
  let busy=false,last=null;
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const when=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return '—';}};
  const status=(ok,label)=>`<span class="release-pill ${ok?'ready':'blocked'}">${ok?'ГОТОВО':'БЛОК'} · ${safe(label)}</span>`;

  function mount(){
    const dashboard=document.getElementById('dashboard');
    if(!dashboard||document.getElementById('deletionAdminPanel'))return;
    const style=document.createElement('style');
    style.id='deletionAdminStyles';
    style.textContent='.release-grid{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:8px}.release-pill{display:block;padding:9px;border-radius:8px;border:1px solid var(--line);font-size:10px;font-weight:850}.release-pill.ready{color:#a7f3d0;border-color:#0ecb8155;background:#0ecb8110}.release-pill.blocked{color:#ffc4cd;border-color:#f6465d55;background:#f6465d10}.deletion-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,1.35fr);gap:10px}.deletion-item{padding:11px;background:var(--p2);border:1px solid var(--line);border-radius:9px;margin:8px 0}.deletion-item p{white-space:pre-wrap;overflow-wrap:anywhere}.audit-table{overflow:auto;max-height:430px}.audit-table table{min-width:760px}.danger-confirm{font-size:10px;color:#ffc4cd}@media(max-width:950px){.release-grid{grid-template-columns:1fr 1fr}.deletion-grid{grid-template-columns:1fr}}@media(max-width:480px){.release-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    const panel=document.createElement('section');
    panel.id='deletionAdminPanel';
    panel.style.marginTop='10px';
    panel.innerHTML='<div class="card"><div class="request-head"><div><h3>Готовность коммерческого запуска</h3><div class="muted">Серверная проверка секретов и платёжных настроек без раскрытия их значений.</div></div><button id="deletionRefresh">Обновить блок</button></div><div id="releaseReadiness" class="release-grid" style="margin-top:10px"><div class="muted">Загрузка…</div></div></div><div class="deletion-grid" style="margin-top:10px"><div class="card"><h3>Запросы на удаление аккаунта</h3><div class="muted">Полное удаление необратимо. Для выполнения необходимо вручную ввести точный email пользователя.</div><div id="deletionRequests"><div class="muted">Загрузка…</div></div></div><div class="card"><h3>Аудит решений</h3><div class="muted">Email и UUID в аудите не сохраняются — только HMAC-хеши и количество удалённых строк.</div><div id="deletionAudit" class="audit-table"></div></div></div>';
    dashboard.appendChild(panel);
    document.getElementById('deletionRefresh').onclick=load;
  }

  function setBusy(value){
    busy=value;
    document.querySelectorAll('[data-delete-action],#deletionRefresh').forEach(button=>button.disabled=value);
  }

  async function session(){const {data}=await sb.auth.getSession();return data.session;}

  async function api(method='GET',body=null){
    const current=await session();
    if(!current)throw new Error('Требуется вход администратора');
    const response=await fetch(ENDPOINT,{method,headers:{Authorization:`Bearer ${current.access_token}`,apikey:'sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  }

  function renderReadiness(value={}){
    const prices=Array.isArray(value.prices)?value.prices:[];
    const paid=prices.map(item=>`${safe(item.plan)}: ${item.active&&item.amount_minor?`${(Number(item.amount_minor)/100).toFixed(2)} ${safe(item.currency)}`:'не настроен'}`).join(' · ');
    document.getElementById('releaseReadiness').innerHTML=[
      status(value.protected_mail,'Защищённая почта'),
      status(value.turnstile_keys,'Turnstile keys'),
      status(value.registration_enabled,'Регистрация'),
      status(value.recovery_enabled,'Восстановление'),
      status(value.paid_plans_configured,'Платные тарифы')
    ].join('')+(paid?`<div class="muted" style="grid-column:1/-1">${paid}</div>`:'');
  }

  function renderRequests(list=[]){
    const root=document.getElementById('deletionRequests');
    root.innerHTML=list.length?list.map((item,index)=>`<article class="deletion-item"><div class="request-head"><b>${safe(item.email||'Email недоступен')}</b><span class="neg">ОЖИДАЕТ</span></div><div class="muted">${safe(item.display_name||'Без имени')} · ${when(item.requested_at)}</div><p>${safe(item.reason||'Причина не указана')}</p><div class="actions"><button data-delete-action="reject" data-index="${index}">Отклонить</button><button class="bad" data-delete-action="complete" data-index="${index}">Удалить навсегда</button></div><div class="danger-confirm">Удаление Auth-пользователя каскадно удалит профиль, подписку, портфель, избранное, журнал, AI- и backtest-историю.</div></article>`).join(''):'<div class="muted" style="margin-top:10px">Нет ожидающих запросов.</div>';
    root.querySelectorAll('[data-delete-action]').forEach(button=>button.onclick=()=>act(list[Number(button.dataset.index)],button.dataset.deleteAction));
  }

  function renderAudit(list=[]){
    const root=document.getElementById('deletionAudit');
    root.innerHTML=list.length?`<table><thead><tr><th>Решение</th><th>Запрошено</th><th>Решено</th><th>Строк</th><th>Примечание</th><th>Ошибка</th></tr></thead><tbody>${list.map(item=>`<tr><td class="${item.action==='completed'?'pos':item.action==='failed'?'neg':''}">${safe(item.action)}</td><td>${when(item.requested_at)}</td><td>${when(item.decided_at)}</td><td>${Number(item.data_counts?.total||0)}</td><td>${safe(item.admin_note||item.reason||'—')}</td><td class="neg">${safe(item.error_code||'—')}</td></tr>`).join('')}</tbody></table>`:'<div class="muted" style="margin-top:10px">Аудит пока пуст.</div>';
  }

  async function load(){
    mount();if(busy)return;setBusy(true);
    try{last=await api();renderReadiness(last.readiness);renderRequests(last.pending||[]);renderAudit(last.audit||[]);}catch(error){message(error.message||error,true);}finally{setBusy(false);}
  }

  async function act(item,action){
    if(busy||!item?.id)return;
    let adminNote='';
    if(action==='reject'){
      adminNote=prompt('Причина отклонения для внутреннего аудита:', '')||'';
      if(!confirm(`Отклонить запрос ${item.email||''}?`))return;
    }else{
      const typed=prompt(`Необратимое удаление. Введите точный email:\n${item.email||''}`, '');
      if(typed===null)return;
      if(String(typed).trim().toLowerCase()!==String(item.email||'').trim().toLowerCase()){message('Email не совпадает. Удаление отменено.',true);return;}
      adminNote=prompt('Внутреннее примечание к удалению — необязательно:', '')||'';
      if(!confirm('Последнее подтверждение: удалить аккаунт и связанные пользовательские данные без возможности восстановления?'))return;
    }
    setBusy(true);
    try{const result=await api('POST',{action,request_id:item.id,admin_note:adminNote,confirmation:action==='complete'?item.email:''});message(action==='complete'?`Аккаунт удалён. Пользовательских строк: ${Number(result.deleted_rows||0)}.`:'Запрос отклонён.');await load();}catch(error){message(error.message||error,true);}finally{setBusy(false);}
  }

  const originalLoad=typeof load==='function'?load:null;
  mount();
  document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(load,0));
  sb.auth.onAuthStateChange((_event,current)=>{if(current)setTimeout(load,0);else{last=null;document.getElementById('deletionAdminPanel')?.remove();}});
  sb.auth.getSession().then(({data})=>{if(data.session)setTimeout(load,0);});
})();