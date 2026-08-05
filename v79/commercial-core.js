'use strict';
(() => {
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-commercial';
  const COPY={
    ru:{title:'Коммерческий доступ',text:'Перед заявкой на платный тариф подтвердите актуальные юридические документы. Оплата пока не подключена — заявка не списывает деньги.',legal:'Юридическое согласие',accepted:'Актуальные документы приняты.',required:'Примите все актуальные документы.',accept:'Принять документы',plans:'Заявка на тариф',note:'Комментарий к заявке — необязательно',request:'Запросить',cancel:'Отменить заявку',pending:'Ожидает обработки',unconfigured:'Оплата не настроена',saved:'Согласие сохранено.',requested:'Заявка создана.',cancelled:'Заявка отменена.',error:'Коммерческий сервис временно недоступен.',docs:{terms:'Условия использования',privacy:'Конфиденциальность',risk:'Раскрытие рисков'}},
    uk:{title:'Комерційний доступ',text:'Перед заявкою на платний тариф підтвердьте актуальні юридичні документи. Оплату ще не підключено — заявка не списує кошти.',legal:'Юридична згода',accepted:'Актуальні документи прийнято.',required:'Прийміть усі актуальні документи.',accept:'Прийняти документи',plans:'Заявка на тариф',note:'Коментар до заявки — необов’язково',request:'Запросити',cancel:'Скасувати заявку',pending:'Очікує обробки',unconfigured:'Оплату не налаштовано',saved:'Згоду збережено.',requested:'Заявку створено.',cancelled:'Заявку скасовано.',error:'Комерційний сервіс тимчасово недоступний.',docs:{terms:'Умови використання',privacy:'Конфіденційність',risk:'Розкриття ризиків'}},
    en:{title:'Commercial access',text:'Accept the current legal documents before requesting a paid plan. Payments are not connected yet, so a request never charges money.',legal:'Legal consent',accepted:'Current documents accepted.',required:'Accept every current document.',accept:'Accept documents',plans:'Plan request',note:'Optional request note',request:'Request',cancel:'Cancel request',pending:'Pending review',unconfigured:'Payment not configured',saved:'Consent saved.',requested:'Request created.',cancelled:'Request cancelled.',error:'Commercial service is temporarily unavailable.',docs:{terms:'Terms of Use',privacy:'Privacy Notice',risk:'Risk Disclosure'}}
  };
  let state=null,busy=false,mounted=false;
  const t=()=>COPY[typeof lang==='string'?lang:'ru']||COPY.ru;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(minor,currency)=>new Intl.NumberFormat(lang==='uk'?'uk-UA':lang==='en'?'en-US':'ru-RU',{style:'currency',currency:currency||'USD'}).format(Number(minor||0)/100);
  const say=(value,bad=false)=>typeof show==='function'&&show(value,bad?'bad':'ok');

  async function currentSession(){const {data}=await client.auth.getSession();return data.session;}
  async function api(method='GET',body=null){
    const active=await currentSession();if(!active)throw new Error('Authentication required');
    const response=await fetch(ENDPOINT,{method,headers:{Authorization:`Bearer ${active.access_token}`,apikey:typeof PUBLISHABLE_KEY==='string'?PUBLISHABLE_KEY:'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||t().error);return data;
  }

  function mount(){
    if(mounted||!document.getElementById('plans'))return;
    mounted=true;
    const style=document.createElement('style');style.id='commercialStyles';style.textContent='.commercial-grid{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(0,1.1fr);gap:10px}.legal-row{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-top:1px solid var(--line)}.legal-row:first-child{border-top:0}.legal-row input{width:auto;margin-top:3px}.commercial-plan{padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--p2);margin-top:8px}.commercial-plan-head{display:flex;justify-content:space-between;gap:10px}.commercial-status{font-size:10px;font-weight:850}.commercial-status.ready{color:#a7f3d0}.commercial-status.blocked{color:#ffc4cd}.commercial-note{width:100%;min-height:64px;resize:vertical;margin-top:9px}@media(max-width:760px){.commercial-grid{grid-template-columns:1fr}}';document.head.appendChild(style);
    const section=document.createElement('section');section.id='commercialCenter';section.className='card';section.style.marginTop='10px';section.innerHTML='<h3 id="commercialTitle"></h3><p id="commercialText" class="muted"></p><div class="commercial-grid"><div><h3 id="commercialLegalTitle"></h3><div id="commercialLegal"></div></div><div><h3 id="commercialPlansTitle"></h3><div id="commercialPlans"></div></div></div>';
    document.getElementById('plans').after(section);
  }

  function removeLegacyButtons(){document.querySelectorAll('#plans .plan > button.btn.gold').forEach(button=>button.remove());}
  function render(){
    mount();removeLegacyButtons();if(!mounted)return;
    const c=t();document.getElementById('commercialTitle').textContent=c.title;document.getElementById('commercialText').textContent=c.text;document.getElementById('commercialLegalTitle').textContent=c.legal;document.getElementById('commercialPlansTitle').textContent=c.plans;
    const documents=Array.isArray(state?.documents)?state.documents:[],accepted=new Map((state?.accepted||[]).map(item=>[item.key,item.version]));
    const legal=document.getElementById('commercialLegal');
    legal.innerHTML=documents.length?documents.map(doc=>{const current=accepted.get(doc.key)===doc.version;return `<label class="legal-row"><input type="checkbox" data-legal="${safe(doc.key)}" ${current?'checked disabled':''}><span><a href="${safe(doc.url)}?lang=${encodeURIComponent(lang)}" target="_blank" rel="noopener">${safe(c.docs[doc.key]||doc.key)}</a><div class="muted">v${safe(doc.version)} · <span class="commercial-status ${current?'ready':'blocked'}">${current?c.accepted:c.required}</span></div></span></label>`;}).join(''):'<div class="muted">—</div>';
    if(!state?.has_current_acceptance&&documents.length)legal.insertAdjacentHTML('beforeend',`<button class="btn gold" id="acceptLegalBtn" style="margin-top:8px">${safe(c.accept)}</button>`);
    const pending=state?.pending_request,prices=Array.isArray(state?.prices)?state.prices:[];
    document.getElementById('commercialPlans').innerHTML=['BASIC','PRO'].map(plan=>{const price=prices.find(item=>item.plan===plan&&item.interval==='month')||prices.find(item=>item.plan===plan),configured=Boolean(price?.active&&price?.amount_minor!=null&&price?.provider&&price.provider!=='unconfigured'),isPending=pending?.requested_plan===plan;return `<div class="commercial-plan"><div class="commercial-plan-head"><b>${plan}</b><span class="commercial-status ${configured?'ready':'blocked'}">${configured?money(price.amount_minor,price.currency):c.unconfigured}</span></div>${isPending?`<p class="muted">${safe(c.pending)}</p><button class="btn" id="cancelPlanRequest">${safe(c.cancel)}</button>`:`<textarea class="commercial-note" data-plan-note="${plan}" maxlength="500" placeholder="${safe(c.note)}"></textarea><button class="btn gold" data-request-plan="${plan}" ${state?.has_current_acceptance?'':'disabled'}>${safe(c.request)} ${plan}</button>`}</div>`;}).join('');
    document.getElementById('acceptLegalBtn')?.addEventListener('click',acceptLegal);
    document.querySelectorAll('[data-request-plan]').forEach(button=>button.addEventListener('click',()=>requestPlan(button.dataset.requestPlan)));
    document.getElementById('cancelPlanRequest')?.addEventListener('click',cancelRequest);
  }

  function setBusy(value){busy=value;document.querySelectorAll('#commercialCenter button,#commercialCenter input,#commercialCenter textarea').forEach(el=>el.disabled=value||(el.dataset?.legal&&el.defaultChecked));}
  async function load(){if(busy)return;mount();setBusy(true);try{const data=await api();state=data.state||{};render();}catch(error){say(error.message||t().error,true);}finally{setBusy(false);}}
  async function acceptLegal(){if(busy)return;const docs=(state?.documents||[]);if(!docs.length)return;const all=docs.every(doc=>document.querySelector(`[data-legal="${CSS.escape(doc.key)}"]`)?.checked);if(!all)return say(t().required,true);setBusy(true);try{const data=await api('POST',{action:'accept_legal',locale:lang,documents:docs.map(doc=>({key:doc.key,version:doc.version}))});state=data.state||{};render();say(t().saved);}catch(error){say(error.message||t().error,true);}finally{setBusy(false);}}
  async function requestPlan(plan){if(busy||!state?.has_current_acceptance)return say(t().required,true);const note=document.querySelector(`[data-plan-note="${plan}"]`)?.value.trim()||'';setBusy(true);try{const data=await api('POST',{action:'request_plan',plan,note});state=data.state||{};render();say(t().requested);}catch(error){say(error.message||t().error,true);}finally{setBusy(false);}}
  async function cancelRequest(){if(busy)return;setBusy(true);try{const data=await api('POST',{action:'cancel_request'});state=data.state||{};render();say(t().cancelled);}catch(error){say(error.message||t().error,true);}finally{setBusy(false);}}

  const observer=new MutationObserver(()=>{if(account&&session){mount();removeLegacyButtons();if(!state)load();}});observer.observe(document.documentElement,{childList:true,subtree:true});
  client.auth.onAuthStateChange((_event,current)=>{if(current){state=null;setTimeout(load,0);}else{state=null;document.getElementById('commercialCenter')?.remove();mounted=false;}});
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(render,0));
  if(account&&session)load();
})();