'use strict';
(() => {
  const REGISTER_ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-register';
  const RECOVERY_ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-recover';
  const TURNSTILE_SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const TEXT={
    ru:{unavailable:'Функция временно недоступна.',captcha:'Подтвердите, что вы не робот.',confirm:'Проверьте почту и подтвердите регистрацию.',reset:'Если аккаунт существует, ссылка восстановления будет отправлена на почту.',email:'Введите корректный email.',password:'Пароль: минимум 10 символов, заглавная и строчная буква, цифра.',working:'Обработка…'},
    uk:{unavailable:'Функція тимчасово недоступна.',captcha:'Підтвердьте, що ви не робот.',confirm:'Перевірте пошту та підтвердьте реєстрацію.',reset:'Якщо акаунт існує, посилання відновлення буде надіслано на пошту.',email:'Введіть коректний email.',password:'Пароль: мінімум 10 символів, велика і мала літера, цифра.',working:'Обробка…'},
    en:{unavailable:'This feature is temporarily unavailable.',captcha:'Complete the anti-bot check.',confirm:'Check your email and confirm registration.',reset:'If the account exists, a recovery link will be sent.',email:'Enter a valid email address.',password:'Password: at least 10 characters with upper case, lower case and a number.',working:'Processing…'}
  };
  const originalFetch=window.fetch.bind(window);
  let registerConfig={enabled:false,site_key:null,captcha_action:'crypto_register'};
  let recoveryConfig={enabled:false,site_key:null,captcha_action:'crypto_recover'};
  let signupToken='',recoveryToken='',signupWidget=null,recoveryWidget=null,turnstileReady=null;

  const locale=()=>typeof lang==='string'&&TEXT[lang]?lang:'ru';
  const copy=()=>TEXT[locale()];
  const el=id=>document.getElementById(id);
  function show(message,type=''){
    const box=el('message');
    if(!box)return;
    box.textContent=String(message||'');
    box.className=`msg show ${type}`;
    clearTimeout(show.timer);
    show.timer=setTimeout(()=>{box.className='msg';},7000);
  }
  function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim())&&String(value||'').trim().length<=254;}
  function strongPassword(value){const v=String(value||'');return v.length>=10&&v.length<=72&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/\d/.test(v);}
  function setBusy(button,busy,normal){if(!button)return;button.disabled=busy;button.textContent=busy?copy().working:normal;}

  function loadTurnstile(){
    if(window.turnstile)return Promise.resolve(window.turnstile);
    if(turnstileReady)return turnstileReady;
    turnstileReady=new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[src^="${TURNSTILE_SCRIPT.split('?')[0]}"]`);
      if(existing){
        const wait=()=>window.turnstile?resolve(window.turnstile):setTimeout(wait,30);
        wait();return;
      }
      const script=document.createElement('script');
      script.src=TURNSTILE_SCRIPT;script.async=true;script.defer=true;
      script.onload=()=>resolve(window.turnstile);
      script.onerror=()=>reject(new Error('Turnstile script unavailable'));
      document.head.appendChild(script);
    });
    return turnstileReady;
  }

  function ensureContainer(form,id,before){
    let box=el(id);
    if(box||!form)return box;
    box=document.createElement('div');box.id=id;
    box.style.cssText='min-height:1px;margin:10px 0;display:flex;justify-content:flex-start';
    if(before)before.before(box);else form.appendChild(box);
    return box;
  }

  async function renderTurnstile(){
    if(!registerConfig.enabled&&!recoveryConfig.enabled)return;
    try{
      const api=await loadTurnstile();
      if(registerConfig.enabled&&registerConfig.site_key&&signupWidget===null){
        const form=el('signupForm'),button=el('signupBtn'),box=ensureContainer(form,'signupTurnstile',button);
        signupWidget=api.render(box,{sitekey:registerConfig.site_key,action:registerConfig.captcha_action||'crypto_register',theme:'dark',size:'flexible',callback:token=>{signupToken=token;},'expired-callback':()=>{signupToken='';},'error-callback':()=>{signupToken='';}});
      }
      if(recoveryConfig.enabled&&recoveryConfig.site_key&&recoveryWidget===null){
        const form=el('loginForm'),actions=form?.querySelector('.actions'),box=ensureContainer(form,'recoveryTurnstile',actions);
        recoveryWidget=api.render(box,{sitekey:recoveryConfig.site_key,action:recoveryConfig.captcha_action||'crypto_recover',theme:'dark',size:'flexible',callback:token=>{recoveryToken=token;},'expired-callback':()=>{recoveryToken='';},'error-callback':()=>{recoveryToken='';}});
      }
    }catch(error){console.warn('Protected auth challenge unavailable',error);}
  }

  async function loadConfig(endpoint){
    try{
      const response=await originalFetch(endpoint,{method:'GET',cache:'no-store'});
      const body=await response.json().catch(()=>({}));
      return response.ok&&body?.ok?body:{enabled:false};
    }catch{return {enabled:false};}
  }

  async function submitSignup(event){
    event.preventDefault();
    const button=el('signupBtn'),normal=copy().confirm;
    if(!registerConfig.enabled)return show(copy().unavailable,'bad');
    const email=el('signupEmail')?.value.trim()||'',password=el('signupPassword')?.value||'';
    if(!validEmail(email))return show(copy().email,'bad');
    if(!strongPassword(password))return show(copy().password,'bad');
    if(!signupToken)return show(copy().captcha,'bad');
    setBusy(button,true,normal);
    try{
      const response=await originalFetch(REGISTER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,display_name:el('signupName')?.value.trim()||'',locale:locale(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Kyiv',captcha_token:signupToken,website:''})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||copy().unavailable);
      show(copy().confirm,'ok');
      el('signupForm')?.reset();signupToken='';
      if(window.turnstile&&signupWidget!==null)window.turnstile.reset(signupWidget);
    }catch(error){show(error instanceof Error?error.message:String(error),'bad');if(window.turnstile&&signupWidget!==null)window.turnstile.reset(signupWidget);signupToken='';}
    finally{if(button){button.disabled=!registerConfig.enabled;button.textContent=(typeof tr==='function'&&tr().signupBtn)||'Создать аккаунт';}}
  }

  async function submitRecovery(){
    const button=el('resetBtn'),normal=(typeof tr==='function'&&tr().reset)||'Восстановить пароль';
    if(!recoveryConfig.enabled)return show(copy().unavailable,'bad');
    const email=el('loginEmail')?.value.trim()||'';
    if(!validEmail(email))return show(copy().email,'bad');
    if(!recoveryToken)return show(copy().captcha,'bad');
    setBusy(button,true,normal);
    try{
      const response=await originalFetch(RECOVERY_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,locale:locale(),captcha_token:recoveryToken,website:''})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||copy().unavailable);
      show(copy().reset,'ok');
    }catch(error){show(error instanceof Error?error.message:String(error),'bad');}
    finally{recoveryToken='';if(window.turnstile&&recoveryWidget!==null)window.turnstile.reset(recoveryWidget);if(button){button.disabled=false;button.textContent=normal;}}
  }

  function applyConfig(){
    const signupButton=el('signupBtn'),password=el('signupPassword'),label=el('newPasswordLabel');
    if(password)password.minLength=10;
    if(label)label.textContent=copy().password;
    if(signupButton&&!registerConfig.enabled){signupButton.disabled=true;signupButton.title=copy().unavailable;}
    const signupForm=el('signupForm');if(signupForm)signupForm.onsubmit=submitSignup;
    const resetButton=el('resetBtn');if(resetButton)resetButton.onclick=submitRecovery;
    window.CRYPTO_AUTH_GATEWAY_STATUS={registration_enabled:!!registerConfig.enabled,recovery_enabled:!!recoveryConfig.enabled,protected_signup:true,protected_recovery:true,direct_supabase_signup_bypassed:true};
    renderTurnstile();
  }

  async function init(){
    [registerConfig,recoveryConfig]=await Promise.all([loadConfig(REGISTER_ENDPOINT),loadConfig(RECOVERY_ENDPOINT)]);
    applyConfig();
  }
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(applyConfig,0));
  window.addEventListener('message',event=>{if(event.data?.type==='crypto-lab-language')setTimeout(applyConfig,0);});
  init();
})();