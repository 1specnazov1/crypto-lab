'use strict';
(() => {
  const button=document.getElementById('run');
  const quotaNode=document.getElementById('quota');
  const loader=document.getElementById('loader');
  const statusNode=document.getElementById('status');
  if(!button||typeof sb==='undefined')return;

  const copy={
    ru:{checking:'FREE · лимит проверяется при запуске',auth:'Войдите в аккаунт для запуска',session:'Не удалось проверить сессию. Повторите ещё раз.',timeout:'Сервер бэктеста не ответил вовремя. Повторите запуск.',failed:'Бэктест не выполнен.'},
    uk:{checking:'FREE · ліміт перевіряється під час запуску',auth:'Увійдіть в акаунт для запуску',session:'Не вдалося перевірити сесію. Спробуйте ще раз.',timeout:'Сервер бектесту не відповів вчасно. Повторіть запуск.',failed:'Бектест не виконано.'},
    en:{checking:'FREE · limit checked on run',auth:'Sign in to run the backtest',session:'Session check failed. Try again.',timeout:'The backtest server did not respond in time. Run it again.',failed:'Backtest failed.'}
  };
  const text=()=>copy[typeof lang==='string'?lang:'ru']||copy.ru;
  let busy=false;

  function withTimeout(promise,ms,label){
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms))
    ]);
  }

  function setBusy(value){
    busy=value;
    button.disabled=value;
    if(loader)loader.classList.toggle('on',value);
  }

  async function safeSession(){
    try{
      const result=await withTimeout(sb.auth.getSession(),5000,text().session);
      return result?.data?.session||null;
    }catch(error){
      console.warn('Backtest session check timed out',error);
      throw error;
    }
  }

  async function safeQuota(){
    if(busy)return;
    if(quotaNode)quotaNode.textContent=text().checking;
    button.disabled=false;
    try{
      const session=await safeSession();
      if(!session){
        if(quotaNode)quotaNode.textContent=text().auth;
        return;
      }
      const result=await withTimeout(sb.rpc('get_crypto_feature_status',{p_feature:'backtest'}),3500,'quota-timeout');
      const data=result?.data,error=result?.error;
      if(error)throw error;
      if(quotaNode){
        quotaNode.textContent=data?.limit<0?'FREE · ∞':`${typeof tr==='function'?tr().left:'Осталось'}: ${data?.remaining??'—'}/${data?.limit??'—'}`;
      }
    }catch(error){
      // Client quota lookup is informational only. The Edge Function enforces quota again server-side.
      if(quotaNode)quotaNode.textContent=text().checking;
      console.warn('Backtest quota preview unavailable; server-side guard remains authoritative',error);
    }finally{
      if(!busy)button.disabled=false;
    }
  }

  async function guardedRun(event){
    event?.preventDefault?.();
    if(busy)return;
    setBusy(true);
    if(statusNode){statusNode.className='status';statusNode.textContent=typeof tr==='function'?tr().loading:'Сервер выполняет бэктест…';}
    try{
      const session=await safeSession();
      if(!session)throw new Error(text().auth);
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),90000);
      let response,data;
      try{
        response=await fetch(URL+'/functions/v1/crypto-lab-v79-backtest-run',{
          method:'POST',
          headers:{Authorization:'Bearer '+session.access_token,apikey:KEY,'Content-Type':'application/json'},
          body:JSON.stringify(payload()),
          signal:controller.signal
        });
        data=await response.json().catch(()=>({}));
      }finally{clearTimeout(timer);}
      if(!response.ok)throw new Error(data?.error||('HTTP '+response.status));
      RESULT=data.result;
      render(data.result);
      if(quotaNode)quotaNode.textContent=data?.quota?.limit<0?'FREE · ∞':`${typeof tr==='function'?tr().left:'Осталось'}: ${data?.quota?.remaining??'—'}/${data?.quota?.limit??'—'}`;
      const engine=document.getElementById('engine');if(engine)engine.textContent='Server engine v'+data.result.engineVersion;
      if(statusNode){statusNode.textContent='OK';statusNode.className='status ok';}
      try{if(typeof load==='function')await load();}catch{}
    }catch(error){
      const message=error?.name==='AbortError'?text().timeout:(error?.message||text().failed);
      if(statusNode){statusNode.textContent=message;statusNode.className='status bad';}
      const body=document.getElementById('body');if(body)body.innerHTML=`<tr><td colspan="12" class="empty neg">${String(message).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</td></tr>`;
    }finally{
      setBusy(false);
      safeQuota();
    }
  }

  // Replace the fragile original client-side launch path. Server-side quota remains authoritative.
  window.run=guardedRun;
  button.onclick=guardedRun;
  button.disabled=false;
  if(quotaNode&&/Проверка доступа|Перевірка доступу|Checking access/i.test(quotaNode.textContent||''))quotaNode.textContent=text().checking;

  // Old quota() may finish later and disable the button; keep it interactive unless a run is actually in progress.
  const observer=new MutationObserver(()=>{if(!busy&&button.disabled)button.disabled=false;});
  observer.observe(button,{attributes:true,attributeFilter:['disabled']});
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(safeQuota,0),{passive:true});
  setTimeout(safeQuota,0);
})();
