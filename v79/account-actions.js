'use strict';
(() => {
  const REGISTER_URL='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-register';
  const COPY={
    ru:{locked:'Регистрация временно закрыта. Защищённый почтовый канал подключён; ожидается активация CAPTCHA.',ready:'Защищённая регистрация доступна: CAPTCHA, серверные лимиты и подтверждение через Resend.',captcha:'Подтвердите, что вы не робот.',weak:'Пароль: 10–72 символа, латинские строчная и заглавная буквы и цифра.',sending:'Создаю аккаунт и отправляю подтверждение…',sent:'Проверьте почту: ссылка подтверждения отправлена через защищённый канал CRYPTO LAB.',failed:'Регистрация сейчас недоступна. Повторите позже.',rate:'Слишком много попыток. Повторите через час.'},
    uk:{locked:'Реєстрацію тимчасово закрито. Захищений поштовий канал підключено; очікується активація CAPTCHA.',ready:'Захищена реєстрація доступна: CAPTCHA, серверні ліміти та підтвердження через Resend.',captcha:'Підтвердьте, що ви не робот.',weak:'Пароль: 10–72 символи, латинські мала й велика літери та цифра.',sending:'Створюю акаунт і надсилаю підтвердження…',sent:'Перевірте пошту: посилання підтвердження надіслано через захищений канал CRYPTO LAB.',failed:'Реєстрація зараз недоступна. Повторіть пізніше.',rate:'Забагато спроб. Повторіть за годину.'},
    en:{locked:'Registration is temporarily closed. Protected email is connected; CAPTCHA activation is pending.',ready:'Protected registration is available with CAPTCHA, server rate limits and Resend confirmation.',captcha:'Complete the CAPTCHA challenge.',weak:'Password: 10–72 characters with lowercase, uppercase and a digit.',sending:'Creating your account and sending confirmation…',sent:'Check your inbox: CRYPTO LAB sent a protected confirmation link.',failed:'Registration is temporarily unavailable. Try again later.',rate:'Too many attempts. Try again in one hour.'}
  };
  let accountActionsInstalled=false,authInstalled=false,config=null,captchaToken='',widgetId=null,turnstilePromise=null;
  const text=()=>COPY[typeof lang==='string'?lang:'ru']||COPY.ru;
  const say=(message,type='')=>{if(typeof show==='function')show(message,type);};

  function lockNativeEmail(){
    try{
      client.auth.signUp=async()=>({data:{user:null,session:null},error:new Error(text().locked)});
      client.auth.resetPasswordForEmail=async()=>({data:null,error:new Error(text().locked)});
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
    turnstilePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.onload=()=>resolve(window.turnstile);script.onerror=()=>reject(new Error('Turnstile unavailable'));document.head.appendChild(script);
    });
    return turnstilePromise;
  }

  async function renderCaptcha(){
    if(!config?.enabled||!config.site_key)return;
    const form=document.getElementById('signupForm');if(!form||form.classList.contains('hide'))return;
    let box=document.getElementById('cryptoRegistrationCaptcha');
    if(!box){box=document.createElement('div');box.id='cryptoRegistrationCaptcha';box.style.margin='12px 0';form.querySelector('#signupBtn')?.before(box);}
    if(widgetId!==null)return;
    try{const turnstile=await loadTurnstile();widgetId=turnstile.render(box,{sitekey:config.site_key,theme:'dark',callback:token=>{captchaToken=token;},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';}});}catch(error){console.warn(error);notice(text().locked,true);}
  }

  function resetCaptcha(){captchaToken='';if(widgetId!==null&&window.turnstile){try{window.turnstile.reset(widgetId);}catch{}}}

  async function submitRegistration(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(!config?.enabled){say(text().locked,'bad');return;}
    const email=document.getElementById('signupEmail')?.value.trim()||'',password=document.getElementById('signupPassword')?.value||'',name=document.getElementById('signupName')?.value.trim()||'',button=document.getElementById('signupBtn');
    if(!passwordStrong(password)){say(text().weak,'bad');return;}
    if(!captchaToken){say(text().captcha,'bad');return;}
    if(button)button.disabled=true;say(text().sending,'');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(REGISTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email,password,display_name:name,locale:lang,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Kyiv',captcha_token:captchaToken,website:document.getElementById('registrationWebsite')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){if(response.status===429)throw new Error(text().rate);throw new Error(data.error||text().failed);}
      document.getElementById('signupPassword').value='';resetCaptcha();document.getElementById('loginTab')?.click();say(text().sent,'ok');
    }catch(error){resetCaptcha();say(error?.name==='AbortError'?text().failed:(error.message||text().failed),'bad');}
    finally{clearTimeout(timer);if(button)button.disabled=false;}
  }

  function applyRegistrationState(){
    const signupTab=document.getElementById('signupTab'),signupForm=document.getElementById('signupForm'),reset=document.getElementById('resetBtn'),password=document.getElementById('signupPassword');
    if(!signupTab||!signupForm||!reset)return;
    reset.hidden=true;reset.disabled=true;
    if(password){password.minLength=10;password.maxLength=72;document.getElementById('newPasswordLabel').textContent=text().weak;}
    lockNativeEmail();
    if(config?.enabled){
      signupTab.hidden=false;signupTab.disabled=false;signupForm.querySelectorAll('input,button').forEach(el=>{el.disabled=false;});
      ['signupEmail','signupPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.required=true;});
      if(!document.getElementById('registrationWebsite')){const hp=document.createElement('input');hp.id='registrationWebsite';hp.name='website';hp.type='text';hp.tabIndex=-1;hp.autocomplete='off';hp.setAttribute('aria-hidden','true');hp.style.cssText='position:absolute;left:-10000px;width:1px;height:1px;opacity:0';signupForm.appendChild(hp);}
      notice(text().ready,false);signupTab.addEventListener('click',()=>setTimeout(renderCaptcha,0));signupForm.addEventListener('submit',submitRegistration,true);
    }else{
      signupTab.hidden=true;signupTab.disabled=true;signupForm.classList.add('hide');signupForm.querySelectorAll('input,button').forEach(el=>{el.disabled=true;el.required=false;});notice(text().locked,true);
    }
  }

  async function installAuth(){
    if(authInstalled||typeof client==='undefined')return;authInstalled=true;
    try{const response=await fetch(REGISTER_URL,{method:'GET',cache:'no-store'});config=await response.json();if(!response.ok)config={enabled:false};}catch{config={enabled:false};}
    applyRegistrationState();
    const originalTranslate=typeof translate==='function'?translate:null;
    if(originalTranslate)window.translate=function(...args){const result=originalTranslate.apply(this,args);applyRegistrationState();return result;};
  }

  function installAccountActions(){
    if(accountActionsInstalled||typeof client==='undefined'||!account||!session)return;
    const plans=document.getElementById('plans');if(!plans||!plans.children.length)return;accountActionsInstalled=true;
    [...plans.querySelectorAll('.plan')].forEach(card=>{const plan=card.querySelector('.plan-name')?.textContent?.trim();if(!['BASIC','PRO'].includes(plan)||plan===account.effective_plan)return;const button=document.createElement('button');button.className='btn gold';button.style.marginTop='12px';button.textContent=lang==='uk'?'Подати заявку':lang==='en'?'Request plan':'Оставить заявку';button.onclick=async()=>{button.disabled=true;const{error}=await client.rpc('request_crypto_plan',{p_plan:plan,p_note:null});button.disabled=false;if(error)show(error.message,'bad');else show(lang==='uk'?`Заявку на ${plan} створено.`:lang==='en'?`${plan} request created.`:`Заявка на ${plan} создана.`,'ok');};card.appendChild(button);});
    if(account.profile?.role==='admin'){const header=document.querySelector('.account-head > div:last-child');if(header&&!document.getElementById('adminPanelBtn')){const button=document.createElement('button');button.id='adminPanelBtn';button.className='btn';button.style.marginLeft='6px';button.textContent='Admin';button.onclick=()=>location.href='./admin.html';header.appendChild(button);}}
  }

  function install(){installAuth();installAccountActions();}
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});setInterval(install,1000);install();
})();