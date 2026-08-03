'use strict';
(() => {
  const REGISTER_URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-register';
  const RECOVERY_URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-recover';
  const EXPORT_URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-data-export';
  const COPY={
    ru:{locked:'Регистрация временно закрыта. Защищённый почтовый канал подключён; ожидается активация CAPTCHA.',ready:'Защищённая регистрация доступна: CAPTCHA, серверные лимиты и подтверждение через Resend.',captcha:'Подтвердите, что вы не робот.',weak:'Пароль: 10–72 символа, латинские строчная и заглавная буквы и цифра.',sending:'Создаю аккаунт и отправляю подтверждение…',sent:'Проверьте почту: ссылка подтверждения отправлена через защищённый канал CRYPTO LAB.',failed:'Регистрация сейчас недоступна. Повторите позже.',rate:'Слишком много попыток. Повторите через час.',recoveryTitle:'Восстановление доступа',recoveryText:'Введите email аккаунта. Ответ не раскрывает, зарегистрирован ли адрес.',recoveryEmail:'Email аккаунта',recoverySend:'Отправить ссылку',recoveryBack:'Назад ко входу',recoverySending:'Проверяю запрос…',recoverySent:'Если аккаунт существует, защищённая ссылка восстановления отправлена на его email.',recoveryUnavailable:'Восстановление пароля временно закрыто до активации CAPTCHA.',dataTitle:'Данные и конфиденциальность',dataText:'Скачайте копию данных аккаунта в JSON. Запрос удаления только ставится в очередь на проверку и не удаляет аккаунт мгновенно.',exportBtn:'Скачать мои данные',exporting:'Готовлю защищённый экспорт…',exported:'Экспорт данных скачан.',exportFail:'Не удалось подготовить экспорт данных.',reason:'Причина удаления — необязательно',deleteBtn:'Запросить удаление аккаунта',cancelDelete:'Отменить запрос',deleteConfirm:'Создать запрос на удаление аккаунта и связанных пользовательских данных?',deleteQueued:'Запрос на удаление создан. До обработки аккаунт продолжает работать.',deleteCancelled:'Запрос на удаление отменён.',deletePending:'Запрос на удаление ожидает обработки с',deleteNone:'Активного запроса на удаление нет.'},
    uk:{locked:'Реєстрацію тимчасово закрито. Захищений поштовий канал підключено; очікується активація CAPTCHA.',ready:'Захищена реєстрація доступна: CAPTCHA, серверні ліміти та підтвердження через Resend.',captcha:'Підтвердьте, що ви не робот.',weak:'Пароль: 10–72 символи, латинські мала й велика літери та цифра.',sending:'Створюю акаунт і надсилаю підтвердження…',sent:'Перевірте пошту: посилання підтвердження надіслано через захищений канал CRYPTO LAB.',failed:'Реєстрація зараз недоступна. Повторіть пізніше.',rate:'Забагато спроб. Повторіть за годину.',recoveryTitle:'Відновлення доступу',recoveryText:'Введіть email акаунта. Відповідь не розкриває, чи зареєстрована адреса.',recoveryEmail:'Email акаунта',recoverySend:'Надіслати посилання',recoveryBack:'Назад до входу',recoverySending:'Перевіряю запит…',recoverySent:'Якщо акаунт існує, захищене посилання відновлення надіслано на його email.',recoveryUnavailable:'Відновлення пароля тимчасово закрито до активації CAPTCHA.',dataTitle:'Дані та конфіденційність',dataText:'Завантажте копію даних акаунта у JSON. Запит на видалення лише ставиться в чергу на перевірку й не видаляє акаунт миттєво.',exportBtn:'Завантажити мої дані',exporting:'Готую захищений експорт…',exported:'Експорт даних завантажено.',exportFail:'Не вдалося підготувати експорт даних.',reason:'Причина видалення — необов’язково',deleteBtn:'Запросити видалення акаунта',cancelDelete:'Скасувати запит',deleteConfirm:'Створити запит на видалення акаунта та пов’язаних користувацьких даних?',deleteQueued:'Запит на видалення створено. До обробки акаунт продовжує працювати.',deleteCancelled:'Запит на видалення скасовано.',deletePending:'Запит на видалення очікує обробки з',deleteNone:'Активного запиту на видалення немає.'},
    en:{locked:'Registration is temporarily closed. Protected email is connected; CAPTCHA activation is pending.',ready:'Protected registration is available with CAPTCHA, server rate limits and Resend confirmation.',captcha:'Complete the CAPTCHA challenge.',weak:'Password: 10–72 characters with lowercase, uppercase and a digit.',sending:'Creating your account and sending confirmation…',sent:'Check your inbox: CRYPTO LAB sent a protected confirmation link.',failed:'Registration is temporarily unavailable. Try again later.',rate:'Too many attempts. Try again in one hour.',recoveryTitle:'Account recovery',recoveryText:'Enter the account email. The response does not reveal whether the address is registered.',recoveryEmail:'Account email',recoverySend:'Send recovery link',recoveryBack:'Back to sign in',recoverySending:'Checking the request…',recoverySent:'If the account exists, a protected recovery link was sent to its email.',recoveryUnavailable:'Password recovery is temporarily closed until CAPTCHA is activated.',dataTitle:'Data and privacy',dataText:'Download a JSON copy of your account data. A deletion request is queued for review and does not delete the account immediately.',exportBtn:'Download my data',exporting:'Preparing a protected export…',exported:'Your data export was downloaded.',exportFail:'The data export could not be prepared.',reason:'Deletion reason — optional',deleteBtn:'Request account deletion',cancelDelete:'Cancel request',deleteConfirm:'Create a request to delete the account and associated user data?',deleteQueued:'Deletion request created. Your account remains active until it is processed.',deleteCancelled:'Deletion request cancelled.',deletePending:'Deletion request pending since',deleteNone:'There is no active deletion request.'}
  };

  let accountActionsInstalled=false,dataControlsInstalled=false,authInstalled=false,registrationHandlersInstalled=false;
  let registrationConfig={enabled:false},recoveryConfig={enabled:false};
  let signupCaptchaToken='',signupWidgetId=null,recoveryCaptchaToken='',recoveryWidgetId=null,turnstilePromise=null;
  const text=()=>COPY[typeof lang==='string'?lang:'ru']||COPY.ru;
  const say=(message,type='')=>{if(typeof show==='function')show(message,type);};

  function lockNativeEmail(){
    try{
      client.auth.signUp=async()=>({data:{user:null,session:null},error:new Error(text().locked)});
      client.auth.resetPasswordForEmail=async()=>({data:null,error:new Error(text().recoveryUnavailable)});
    }catch(error){console.warn('Unable to lock built-in Auth email methods',error);}
  }

  function notice(message,bad=false){
    const loginForm=document.getElementById('loginForm'),card=loginForm?.closest('.card');
    if(!card)return;
    let node=document.getElementById('authEmailSafetyNotice');
    if(!node){node=document.createElement('div');node.id='authEmailSafetyNotice';node.className='msg show';node.style.cssText='display:block;margin-top:12px';card.appendChild(node);}
    node.textContent=message;node.className='msg show'+(bad?' bad':' ok');
  }

  function passwordStrong(value){return value.length>=10&&value.length<=72&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value);}

  function loadTurnstile(){
    if(window.turnstile)return Promise.resolve(window.turnstile);
    if(turnstilePromise)return turnstilePromise;
    turnstilePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.onload=()=>resolve(window.turnstile);script.onerror=()=>reject(new Error('Turnstile unavailable'));document.head.appendChild(script);});
    return turnstilePromise;
  }

  async function renderSignupCaptcha(){
    if(!registrationConfig?.enabled||!registrationConfig.site_key)return;
    const form=document.getElementById('signupForm');if(!form||form.classList.contains('hide'))return;
    let box=document.getElementById('cryptoRegistrationCaptcha');
    if(!box){box=document.createElement('div');box.id='cryptoRegistrationCaptcha';box.style.margin='12px 0';form.querySelector('#signupBtn')?.before(box);}
    if(signupWidgetId!==null)return;
    try{const turnstile=await loadTurnstile();signupWidgetId=turnstile.render(box,{sitekey:registrationConfig.site_key,theme:'dark',callback:token=>{signupCaptchaToken=token;},'expired-callback':()=>{signupCaptchaToken='';},'error-callback':()=>{signupCaptchaToken='';}});}catch(error){console.warn(error);notice(text().locked,true);}
  }

  async function renderRecoveryCaptcha(){
    if(!recoveryConfig?.enabled||!recoveryConfig.site_key)return;
    const panel=document.getElementById('protectedRecoveryRequest');if(!panel||panel.classList.contains('hide'))return;
    const box=document.getElementById('cryptoRecoveryCaptcha');if(!box||recoveryWidgetId!==null)return;
    try{const turnstile=await loadTurnstile();recoveryWidgetId=turnstile.render(box,{sitekey:recoveryConfig.site_key,theme:'dark',callback:token=>{recoveryCaptchaToken=token;},'expired-callback':()=>{recoveryCaptchaToken='';},'error-callback':()=>{recoveryCaptchaToken='';}});}catch(error){console.warn(error);say(text().recoveryUnavailable,'bad');}
  }

  function resetSignupCaptcha(){signupCaptchaToken='';if(signupWidgetId!==null&&window.turnstile){try{window.turnstile.reset(signupWidgetId);}catch{}}}
  function resetRecoveryCaptcha(){recoveryCaptchaToken='';if(recoveryWidgetId!==null&&window.turnstile){try{window.turnstile.reset(recoveryWidgetId);}catch{}}}

  async function submitRegistration(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(!registrationConfig?.enabled){say(text().locked,'bad');return;}
    const email=document.getElementById('signupEmail')?.value.trim()||'',password=document.getElementById('signupPassword')?.value||'',name=document.getElementById('signupName')?.value.trim()||'',button=document.getElementById('signupBtn');
    if(!passwordStrong(password)){say(text().weak,'bad');return;}
    if(!signupCaptchaToken){say(text().captcha,'bad');return;}
    if(button)button.disabled=true;say(text().sending,'');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(REGISTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email,password,display_name:name,locale:lang,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Kyiv',captcha_token:signupCaptchaToken,website:document.getElementById('registrationWebsite')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){if(response.status===429)throw new Error(text().rate);throw new Error(data.error||text().failed);}
      document.getElementById('signupPassword').value='';resetSignupCaptcha();document.getElementById('loginTab')?.click();say(text().sent,'ok');
    }catch(error){resetSignupCaptcha();say(error?.name==='AbortError'?text().failed:(error.message||text().failed),'bad');}
    finally{clearTimeout(timer);if(button)button.disabled=false;}
  }

  function ensureRecoveryPanel(){
    if(document.getElementById('protectedRecoveryRequest'))return;
    const loginForm=document.getElementById('loginForm');if(!loginForm)return;
    const panel=document.createElement('form');panel.id='protectedRecoveryRequest';panel.className='hide';panel.innerHTML='<h2 id="protectedRecoveryTitle"></h2><p id="protectedRecoveryText" class="muted"></p><div class="field"><label id="protectedRecoveryEmailLabel" for="protectedRecoveryEmail"></label><input id="protectedRecoveryEmail" type="email" autocomplete="email" maxlength="254" required></div><input id="recoveryWebsite" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0"><div id="cryptoRecoveryCaptcha" style="margin:12px 0"></div><div class="actions"><button class="btn gold" id="protectedRecoverySend" type="submit"></button><button class="btn" id="protectedRecoveryBack" type="button"></button></div>';
    loginForm.after(panel);
    panel.addEventListener('submit',submitRecovery,true);
    document.getElementById('protectedRecoveryBack').onclick=()=>showLogin();
    applyDataLabels();
  }

  function showLogin(){
    document.getElementById('protectedRecoveryRequest')?.classList.add('hide');
    document.getElementById('loginForm')?.classList.remove('hide');
    document.getElementById('signupForm')?.classList.add('hide');
    document.getElementById('recoveryForm')?.classList.add('hide');
    document.getElementById('loginTab')?.classList.add('on');
    document.getElementById('signupTab')?.classList.remove('on');
  }

  function showRecoveryRequest(){
    if(!recoveryConfig?.enabled){say(text().recoveryUnavailable,'bad');return;}
    ensureRecoveryPanel();
    const source=document.getElementById('loginEmail')?.value.trim();if(source)document.getElementById('protectedRecoveryEmail').value=source;
    document.getElementById('loginForm')?.classList.add('hide');
    document.getElementById('signupForm')?.classList.add('hide');
    document.getElementById('recoveryForm')?.classList.add('hide');
    document.getElementById('protectedRecoveryRequest')?.classList.remove('hide');
    document.getElementById('loginTab')?.classList.remove('on');
    document.getElementById('signupTab')?.classList.remove('on');
    setTimeout(renderRecoveryCaptcha,0);
  }

  async function submitRecovery(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(!recoveryConfig?.enabled){say(text().recoveryUnavailable,'bad');return;}
    const email=document.getElementById('protectedRecoveryEmail')?.value.trim()||'',button=document.getElementById('protectedRecoverySend');
    if(!recoveryCaptchaToken){say(text().captcha,'bad');return;}
    if(button)button.disabled=true;say(text().recoverySending,'');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(RECOVERY_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email,locale:lang,captcha_token:recoveryCaptchaToken,website:document.getElementById('recoveryWebsite')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){if(response.status===429)throw new Error(text().rate);throw new Error(data.error||text().recoveryUnavailable);}
      resetRecoveryCaptcha();showLogin();say(text().recoverySent,'ok');
    }catch(error){resetRecoveryCaptcha();say(error?.name==='AbortError'?text().recoveryUnavailable:(error.message||text().recoveryUnavailable),'bad');}
    finally{clearTimeout(timer);if(button)button.disabled=false;}
  }

  function applyAuthState(){
    const signupTab=document.getElementById('signupTab'),signupForm=document.getElementById('signupForm'),reset=document.getElementById('resetBtn'),password=document.getElementById('signupPassword');
    if(!signupTab||!signupForm||!reset)return;
    lockNativeEmail();ensureRecoveryPanel();
    reset.hidden=!recoveryConfig?.enabled;reset.disabled=!recoveryConfig?.enabled;reset.onclick=event=>{event.preventDefault();showRecoveryRequest();};
    if(password){password.minLength=10;password.maxLength=72;document.getElementById('newPasswordLabel').textContent=text().weak;}
    if(registrationConfig?.enabled){
      signupTab.hidden=false;signupTab.disabled=false;signupForm.querySelectorAll('input,button').forEach(el=>{el.disabled=false;});
      ['signupEmail','signupPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.required=true;});
      if(!document.getElementById('registrationWebsite')){const hp=document.createElement('input');hp.id='registrationWebsite';hp.name='website';hp.type='text';hp.tabIndex=-1;hp.autocomplete='off';hp.setAttribute('aria-hidden','true');hp.style.cssText='position:absolute;left:-10000px;width:1px;height:1px;opacity:0';signupForm.appendChild(hp);}
      notice(text().ready,false);
      if(!registrationHandlersInstalled){registrationHandlersInstalled=true;signupTab.addEventListener('click',()=>setTimeout(renderSignupCaptcha,0));signupForm.addEventListener('submit',submitRegistration,true);}
    }else{
      signupTab.hidden=true;signupTab.disabled=true;signupForm.classList.add('hide');signupForm.querySelectorAll('input,button').forEach(el=>{el.disabled=true;el.required=false;});notice(text().locked,true);
    }
  }

  async function loadConfig(url){
    try{const response=await fetch(url,{method:'GET',cache:'no-store'});const data=await response.json();return response.ok?data:{enabled:false};}catch{return {enabled:false};}
  }

  async function installAuth(){
    if(authInstalled||typeof client==='undefined')return;authInstalled=true;
    [registrationConfig,recoveryConfig]=await Promise.all([loadConfig(REGISTER_URL),loadConfig(RECOVERY_URL)]);
    applyAuthState();
    const originalTranslate=typeof translate==='function'?translate:null;
    if(originalTranslate)window.translate=function(...args){const result=originalTranslate.apply(this,args);applyAuthState();applyDataLabels();return result;};
  }

  function applyDataLabels(){
    const t=text(),pairs={privacyDataTitle:'dataTitle',privacyDataText:'dataText',exportDataBtn:'exportBtn',deletionReason:'reason',requestDeletionBtn:'deleteBtn',cancelDeletionBtn:'cancelDelete',protectedRecoveryTitle:'recoveryTitle',protectedRecoveryText:'recoveryText',protectedRecoveryEmailLabel:'recoveryEmail',protectedRecoverySend:'recoverySend',protectedRecoveryBack:'recoveryBack'};
    Object.entries(pairs).forEach(([id,key])=>{const el=document.getElementById(id);if(el){if(el.tagName==='TEXTAREA')el.placeholder=t[key];else el.textContent=t[key];}});
  }

  async function loadDeletionState(){
    const state=document.getElementById('deletionState'),requestBtn=document.getElementById('requestDeletionBtn'),cancelBtn=document.getElementById('cancelDeletionBtn');if(!state||!session?.user)return;
    const {data,error}=await client.from('crypto_account_deletion_requests').select('id,status,requested_at').eq('user_id',session.user.id).eq('status','pending').order('requested_at',{ascending:false}).limit(1).maybeSingle();
    if(error){state.textContent=error.message;state.className='muted neg';return;}
    if(data){const locale=lang==='uk'?'uk-UA':lang==='en'?'en-GB':'ru-RU';state.textContent=`${text().deletePending} ${new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.requested_at))}.`;state.className='muted';if(requestBtn)requestBtn.hidden=true;if(cancelBtn)cancelBtn.hidden=false;}
    else{state.textContent=text().deleteNone;state.className='muted';if(requestBtn)requestBtn.hidden=false;if(cancelBtn)cancelBtn.hidden=true;}
  }

  async function exportData(){
    const button=document.getElementById('exportDataBtn');if(!session?.access_token)return say('Authentication required','bad');
    if(button)button.disabled=true;say(text().exporting,'');
    try{
      const response=await fetch(EXPORT_URL,{method:'GET',headers:{Authorization:`Bearer ${session.access_token}`,apikey:typeof PUBLISHABLE_KEY==='string'?PUBLISHABLE_KEY:''},cache:'no-store'});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||text().exportFail);}
      const blob=await response.blob(),disposition=response.headers.get('content-disposition')||'',match=disposition.match(/filename="?([^";]+)"?/i),name=match?.[1]||`crypto-lab-data-${new Date().toISOString().slice(0,10)}.json`,url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);say(text().exported,'ok');
    }catch(error){say(error.message||text().exportFail,'bad');}
    finally{if(button)button.disabled=false;}
  }

  async function requestDeletion(){
    if(!confirm(text().deleteConfirm))return;
    const button=document.getElementById('requestDeletionBtn'),reason=document.getElementById('deletionReason')?.value.trim()||'';if(button)button.disabled=true;
    const {error}=await client.rpc('request_crypto_account_deletion',{p_reason:reason||null});if(button)button.disabled=false;
    if(error)return say(error.message,'bad');say(text().deleteQueued,'ok');await loadDeletionState();
  }

  async function cancelDeletion(){
    const button=document.getElementById('cancelDeletionBtn');if(button)button.disabled=true;
    const {error}=await client.rpc('cancel_crypto_account_deletion');if(button)button.disabled=false;
    if(error)return say(error.message,'bad');say(text().deleteCancelled,'ok');await loadDeletionState();
  }

  function installDataControls(){
    if(dataControlsInstalled||!account||!session)return;
    const plansTitle=document.getElementById('plansTitle');if(!plansTitle)return;dataControlsInstalled=true;
    const card=document.createElement('section');card.id='privacyDataCard';card.className='card';card.style.marginTop='10px';card.innerHTML='<h3 id="privacyDataTitle"></h3><p id="privacyDataText" class="muted"></p><div class="actions"><button class="btn gold" id="exportDataBtn"></button></div><div style="border-top:1px solid var(--line);margin-top:14px;padding-top:14px"><textarea id="deletionReason" rows="2" maxlength="1000" style="width:100%;resize:vertical"></textarea><div class="actions" style="margin-top:8px"><button class="btn bad" id="requestDeletionBtn"></button><button class="btn" id="cancelDeletionBtn" hidden></button></div><p id="deletionState" class="muted"></p></div>';
    plansTitle.before(card);applyDataLabels();document.getElementById('exportDataBtn').onclick=exportData;document.getElementById('requestDeletionBtn').onclick=requestDeletion;document.getElementById('cancelDeletionBtn').onclick=cancelDeletion;loadDeletionState();
  }

  function installAccountActions(){
    if(accountActionsInstalled||typeof client==='undefined'||!account||!session)return;
    const plans=document.getElementById('plans');if(!plans||!plans.children.length)return;accountActionsInstalled=true;
    [...plans.querySelectorAll('.plan')].forEach(card=>{const plan=card.querySelector('.plan-name')?.textContent?.trim();if(!['BASIC','PRO'].includes(plan)||plan===account.effective_plan)return;const button=document.createElement('button');button.className='btn gold';button.style.marginTop='12px';button.textContent=lang==='uk'?'Подати заявку':lang==='en'?'Request plan':'Оставить заявку';button.onclick=async()=>{button.disabled=true;const{error}=await client.rpc('request_crypto_plan',{p_plan:plan,p_note:null});button.disabled=false;if(error)show(error.message,'bad');else show(lang==='uk'?`Заявку на ${plan} створено.`:lang==='en'?`${plan} request created.`:`Заявка на ${plan} создана.`,'ok');};card.appendChild(button);});
    if(account.profile?.role==='admin'){const header=document.querySelector('.account-head > div:last-child');if(header&&!document.getElementById('adminPanelBtn')){const button=document.createElement('button');button.id='adminPanelBtn';button.className='btn';button.style.marginLeft='6px';button.textContent='Admin';button.onclick=()=>location.href='./admin.html';header.appendChild(button);}}
  }

  function install(){installAuth();installDataControls();installAccountActions();}
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});setInterval(install,1000);install();
})();