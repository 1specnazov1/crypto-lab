'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const when=value=>value?new Date(value).toLocaleString():'—';
  let mounted=false,busy=false,state=null;
  function notify(value,bad=false){if(typeof message==='function')message(value,bad);}
  function badge(ok,label){return `<span class="provider-pill ${ok?'ready':'blocked'}">${ok?'ГОТОВО':'БЛОК'} · ${safe(label)}</span>`;}
  function blockerLabels(blockers){
    const labels={adapter_disabled:'Режим disabled',runtime_secrets_not_verified:'Секреты не проверены сервером',checkout_disabled:'Checkout отключён',webhook_disabled:'Webhook отключён',no_active_paid_price:'Нет активной цены'};
    return Object.values(blockers||{}).filter(Boolean).map(value=>`<li>${safe(labels[value]||value)}</li>`).join('');
  }
  function capabilityLabels(value){
    const labels={one_time:'Разовая оплата',recurring:'Рекуррентная оплата',refunds:'Возвраты',async_payments:'Асинхронные статусы',raw_body_required:'Raw body',callback_encoding:'Callback encoding'};
    return Object.entries(value||{}).map(([key,item])=>`<span class="provider-cap"><b>${safe(labels[key]||key)}</b>: ${safe(typeof item==='boolean'?(item?'да':'нет'):item)}</span>`).join('');
  }
  function mount(){
    if(mounted||!$('dashboard'))return;mounted=true;
    const style=document.createElement('style');style.id='providerReadinessStyles';style.textContent='.provider-grid{display:grid;grid-template-columns:repeat(3,minmax(250px,1fr));gap:10px;margin-top:10px}.provider-card{background:var(--p);border:1px solid var(--line);border-radius:10px;padding:13px}.provider-card h3{margin:0}.provider-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.provider-meta{color:var(--m);font-size:10px;margin-top:5px}.provider-pill{display:inline-flex;padding:5px 8px;border:1px solid var(--line);border-radius:999px;font-size:9px;font-weight:850;margin:4px 3px 0 0}.provider-pill.ready{color:#a7f3d0;border-color:#0ecb8155}.provider-pill.blocked{color:#ffc4cd;border-color:#f6465d55}.provider-cap{display:block;padding:4px 0;color:var(--m)}.provider-cap b{color:var(--t)}.provider-blockers{padding-left:18px;color:#ffc4cd}.provider-secrets{font:10px ui-monospace,monospace;color:var(--m);word-break:break-word}.provider-policy{padding:10px;background:var(--p2);border:1px solid var(--line);border-radius:8px;margin-top:10px}@media(max-width:1050px){.provider-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.provider-grid{grid-template-columns:1fr}.provider-head{align-items:stretch;flex-direction:column}.provider-card button{min-height:42px}}';document.head.appendChild(style);
    const section=document.createElement('section');section.id='providerReadiness';section.style.marginTop='10px';section.innerHTML='<div class="card"><div class="request-head"><div><h3>Готовность платёжных провайдеров</h3><div class="muted">Панель показывает только названия требуемых секретов и серверные флаги. Значения ключей никогда не передаются в браузер.</div></div><button id="providerReadinessRefresh">Обновить</button></div><div id="providerPolicy" class="provider-policy"></div><div id="providerGrid" class="provider-grid"></div></div>';
    $('dashboard').appendChild(section);$('providerReadinessRefresh').onclick=load;
  }
  function setBusy(value){busy=value;const button=$('providerReadinessRefresh');if(button)button.disabled=value;}
  function render(){
    mount();const adapters=Array.isArray(state?.adapters)?state.adapters:[],policy=state?.activation_policy||{};
    $('providerPolicy').innerHTML=`${badge(Boolean(policy.requires_runtime_secret_verification),'Runtime secret verification')} ${badge(Boolean(policy.requires_positive_active_price),'Положительная активная цена')} ${badge(Boolean(policy.requires_signed_webhook),'Подписанный webhook')} ${badge(policy.admin_can_activate_without_runtime_verification===false,'Нет ручного обхода')}`;
    $('providerGrid').innerHTML=adapters.map(item=>{
      const blockers=blockerLabels(item.blockers),prices=Array.isArray(item.active_prices)?item.active_prices:[];
      return `<article class="provider-card"><div class="provider-head"><div><h3>${safe(String(item.provider||'').toUpperCase())}</h3><div class="provider-meta">contract v${Number(item.contract_version||1)} · ${safe(item.checkout_strategy)} · ${safe(item.webhook_strategy)}</div></div><div>${badge(item.lifecycle_status==='verified'||item.lifecycle_status==='active',item.lifecycle_status)} ${badge(item.desired_mode!=='disabled',item.desired_mode)}</div></div><div style="margin-top:8px">${capabilityLabels(item.capabilities)}</div><div class="provider-meta">Checkout ${item.checkout_enabled?'ON':'OFF'} · Webhook ${item.webhook_enabled?'ON':'OFF'} · Recurring ${item.recurring_enabled?'ON':'OFF'} · Refunds ${item.refunds_enabled?'ON':'OFF'}</div><div class="provider-meta">Последняя проверка: ${when(item.last_verified_at)}</div><div class="provider-secrets">Требуются: ${safe((item.required_secret_names||[]).join(', ')||'нет')}</div>${prices.length?`<div class="provider-meta">Активные цены: ${safe(prices.map(p=>`${p.plan} ${p.amount_minor} ${p.currency}/${p.interval}`).join(' · '))}</div>`:''}${blockers?`<ul class="provider-blockers">${blockers}</ul>`:'<div class="pos" style="margin-top:8px">Блокирующих условий базы нет.</div>'}${item.last_error_code?`<div class="neg">${safe(item.last_error_code)}</div>`:''}</article>`;
    }).join('')||'<div class="muted">Контракты провайдеров отсутствуют.</div>';
  }
  async function load(){if(busy)return;mount();setBusy(true);try{const {data,error}=await sb.rpc('get_crypto_admin_provider_adapters');if(error)throw error;state=data||{};render();}catch(error){notify(error.message||error,true);}finally{setBusy(false);}}
  function boot(){mount();if(!$('dashboard')?.classList.contains('hide')&&!state)load();}
  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  $('refresh')?.addEventListener('click',()=>setTimeout(load,0));
  sb.auth.onAuthStateChange((_event,current)=>{state=null;if(current)setTimeout(load,0);});
  boot();
})();