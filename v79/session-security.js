'use strict';
(() => {
  const COPY={ru:{title:'Безопасность сессии',last:'Последний вход',expires:'Сессия до',confirmed:'Email подтверждён',aal:'Уровень защиты',refresh:'Обновить сессию',global:'Выйти на всех устройствах',refreshed:'Сессия обновлена.',signedOut:'Выход выполнен на всех устройствах.',confirmGlobal:'Завершить все активные сессии CRYPTO LAB на всех устройствах?',expired:'Сессия завершена. Войдите снова.',unknown:'—'},uk:{title:'Безпека сесії',last:'Останній вхід',expires:'Сесія до',confirmed:'Email підтверджено',aal:'Рівень захисту',refresh:'Оновити сесію',global:'Вийти на всіх пристроях',refreshed:'Сесію оновлено.',signedOut:'Вихід виконано на всіх пристроях.',confirmGlobal:'Завершити всі активні сесії CRYPTO LAB на всіх пристроях?',expired:'Сесію завершено. Увійдіть знову.',unknown:'—'},en:{title:'Session security',last:'Last sign-in',expires:'Session expires',confirmed:'Email confirmed',aal:'Assurance level',refresh:'Refresh session',global:'Sign out all devices',refreshed:'Session refreshed.',signedOut:'Signed out on all devices.',confirmGlobal:'End every active CRYPTO LAB session on all devices?',expired:'Your session ended. Sign in again.',unknown:'—'}};
  const language=()=>typeof lang==='string'?lang:'ru';
  const text=()=>COPY[language()]||COPY.ru;
  const fmt=value=>value?new Date(value).toLocaleString():text().unknown;
  let mounted=false,busy=false,lastSessionId=null,loadQueued=false;
  const channel='BroadcastChannel' in window?new BroadcastChannel('crypto-lab-auth'):null;
  function notify(value,bad=false){if(typeof show==='function')show(value,bad?'bad':'ok');}
  function setText(id,value){const node=document.getElementById(id);if(node&&node.textContent!==String(value))node.textContent=String(value);}
  function card(){
    if(mounted||!document.getElementById('accountView')||!session)return;
    const accountView=document.getElementById('accountView');
    const node=document.createElement('section');node.id='sessionSecurityCard';node.className='card';node.style.marginTop='10px';node.innerHTML='<div class="account-head"><div><h3 id="sessionSecurityTitle"></h3><div class="muted" id="sessionSecurityUser"></div></div><div class="actions"><button class="btn" id="refreshSessionBtn"></button><button class="btn bad" id="globalLogoutBtn"></button></div></div><div class="stats"><div class="stat"><span id="lastSignInLabel"></span><b id="lastSignIn">—</b></div><div class="stat"><span id="sessionExpiryLabel"></span><b id="sessionExpiry">—</b></div><div class="stat"><span id="emailConfirmedLabel"></span><b id="emailConfirmed">—</b></div><div class="stat"><span id="aalLabel"></span><b id="aalValue">—</b></div></div>';
    accountView.querySelector('.card')?.after(node);mounted=true;
    document.getElementById('refreshSessionBtn').onclick=refreshSession;
    document.getElementById('globalLogoutBtn').onclick=globalLogout;
    translateCard();queueLoadState();
  }
  function translateCard(){if(!mounted)return;const c=text();setText('sessionSecurityTitle',c.title);setText('lastSignInLabel',c.last);setText('sessionExpiryLabel',c.expires);setText('emailConfirmedLabel',c.confirmed);setText('aalLabel',c.aal);setText('refreshSessionBtn',c.refresh);setText('globalLogoutBtn',c.global);}
  function setBusy(value){busy=value;['refreshSessionBtn','globalLogoutBtn'].forEach(id=>{const button=document.getElementById(id);if(button)button.disabled=value;});}
  function queueLoadState(){if(loadQueued)return;loadQueued=true;setTimeout(()=>{loadQueued=false;loadState();},0);}
  async function loadState(){if(!session||busy||!mounted)return;try{const {data,error}=await client.rpc('get_my_crypto_security_state');if(error)throw error;setText('sessionSecurityUser',session.user?.email||'');setText('lastSignIn',fmt(data?.last_sign_in_at));setText('sessionExpiry',fmt(data?.session_expires_at));setText('emailConfirmed',fmt(data?.email_confirmed_at));setText('aalValue',String(data?.aal||'aal1').toUpperCase());lastSessionId=session.access_token?.slice(-12)||null;}catch(error){console.warn('Security state unavailable',error);}}
  async function refreshSession(){if(busy)return;setBusy(true);try{const {data,error}=await client.auth.refreshSession();if(error)throw error;session=data.session;notify(text().refreshed);await loadState();}catch(error){notify(error.message||error,true);}finally{setBusy(false);}}
  async function globalLogout(){if(busy||!confirm(text().confirmGlobal))return;setBusy(true);try{const {error}=await client.auth.signOut({scope:'global'});if(error)throw error;channel?.postMessage({type:'GLOBAL_SIGNOUT',at:Date.now()});notify(text().signedOut);}catch(error){notify(error.message||error,true);}finally{setBusy(false);}}
  async function verifySession(){try{const {data,error}=await client.auth.getSession();if(error||!data.session){if(document.getElementById('accountView')&&!document.getElementById('accountView').classList.contains('hide'))notify(text().expired,true);return;}session=data.session;if(lastSessionId!==session.access_token?.slice(-12))queueLoadState();}catch(error){console.warn('Session verification failed',error);}}
  channel?.addEventListener('message',event=>{if(event.data?.type==='GLOBAL_SIGNOUT')client.auth.signOut({scope:'local'}).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)verifySession();},{passive:true});
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(translateCard,0),{passive:true});
  setInterval(verifySession,300000);
  client.auth.onAuthStateChange((_event,current)=>{session=current;if(!current){mounted=false;document.getElementById('sessionSecurityCard')?.remove();}else setTimeout(()=>{card();translateCard();},0);});
  card();
  setTimeout(()=>{card();translateCard();},250);
})();
