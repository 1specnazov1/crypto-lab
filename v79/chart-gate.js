'use strict';
(() => {
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-chart';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const AUTH_KEY='sb-txhzxbizjpinowepfjkm-auth-token';
  const $=id=>document.getElementById(id);
  const Q=new URLSearchParams(location.search);
  const lang=['ru','uk','en'].includes(Q.get('lang')||'')?Q.get('lang'):(localStorage.getItem('cryptoLabLanguage')||'ru');
  const T={
    ru:{title:'График и аналитика',checking:'Проверяю дневной лимит аналитики…',preparing:'Подготовка графика…',auth:'Нужен активный вход в CRYPTO LAB.',limit:'Дневной лимит Chart & Analytics исчерпан. Доступно 100 открытий в день.',rate:'Слишком много быстрых открытий. Повторите через несколько секунд.',failed:'Не удалось проверить доступ к графику.',back:'Вернуться'},
    uk:{title:'Графік та аналітика',checking:'Перевіряю денний ліміт аналітики…',preparing:'Підготовка графіка…',auth:'Потрібен активний вхід у CRYPTO LAB.',limit:'Денний ліміт Chart & Analytics вичерпано. Доступно 100 відкриттів на день.',rate:'Забагато швидких відкриттів. Повторіть за кілька секунд.',failed:'Не вдалося перевірити доступ до графіка.',back:'Повернутися'},
    en:{title:'Chart & Analytics',checking:'Checking your daily analytics limit…',preparing:'Preparing chart…',auth:'An active CRYPTO LAB session is required.',limit:'Daily Chart & Analytics limit reached. You can open it 100 times per day.',rate:'Too many rapid opens. Try again in a few seconds.',failed:'Could not verify Chart access.',back:'Go back'}
  };
  const tr=()=>T[lang]||T.ru;
  function token(){try{const raw=localStorage.getItem(AUTH_KEY);if(!raw)return'';const v=JSON.parse(raw);return String(v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||'')}catch{return''}}
  function fail(text){$('state').textContent=text;$('state').className='state bad';$('back').hidden=false}
  function target(){const p=new URLSearchParams(location.search);return './chart.html'+(p.toString()?'?'+p.toString():'')}
  async function run(){document.documentElement.lang=lang;$('title').textContent=tr().title;$('text').textContent=tr().checking;$('state').textContent=tr().preparing;$('back').textContent=tr().back;const jwt=token();if(!jwt)return fail(tr().auth);try{const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,apikey:APIKEY,'Content-Type':'application/json'},body:'{}',cache:'no-store'}),b=await r.json().catch(()=>({}));if(r.status===401)return fail(tr().auth);if(r.status===429&&b?.code==='QUOTA_EXCEEDED')return fail(tr().limit);if(r.status===429)return fail(tr().rate);if(!r.ok||!b?.ok)return fail(tr().failed);sessionStorage.setItem('cryptoLabChartQuota',JSON.stringify({at:Date.now(),quota:b.quota||null}));location.replace(target())}catch{return fail(tr().failed)}}
  $('back').onclick=()=>{try{parent.postMessage({type:'crypto-lab-chart-gate-back'},location.origin)}catch{}history.back()};
  run();
})();
