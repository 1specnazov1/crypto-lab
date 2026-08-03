'use strict';
(() => {
  const LIMIT_MS=30*60*1000,WARNING_MS=5*60*1000;
  let lastActivity=Date.now(),timer=null,warningShown=false;
  const channel='BroadcastChannel' in window?new BroadcastChannel('crypto-lab-auth'):null;
  function activeDashboard(){return !document.getElementById('dashboard')?.classList.contains('hide');}
  function ensureBadge(){
    let badge=document.getElementById('adminSessionGuard');if(badge)return badge;
    badge=document.createElement('span');badge.id='adminSessionGuard';badge.className='muted';badge.style.cssText='font-size:10px;white-space:nowrap';
    document.querySelector('.top .spacer')?.after(badge);return badge;
  }
  function reset(){lastActivity=Date.now();warningShown=false;update();}
  function update(){
    const badge=ensureBadge();if(!badge)return;
    if(!activeDashboard()){badge.textContent='';return;}
    const remaining=Math.max(0,LIMIT_MS-(Date.now()-lastActivity));
    const minutes=Math.ceil(remaining/60000);badge.textContent=`ADMIN SESSION · ${minutes} min`;
    if(remaining<=WARNING_MS&&!warningShown){warningShown=true;if(typeof message==='function')message(`Сессия администратора завершится через ${minutes} мин. Любое действие продлит её.`);}
    if(remaining<=0)lock();
  }
  async function lock(){
    clearInterval(timer);timer=null;
    try{await sb.auth.signOut({scope:'local'});}catch{}
    channel?.postMessage({type:'ADMIN_SESSION_LOCKED',at:Date.now()});
    if(typeof message==='function')message('Сессия администратора завершена из-за бездействия.',true);
    document.getElementById('dashboard')?.classList.add('hide');document.getElementById('login')?.classList.remove('hide');
  }
  ['pointerdown','keydown','touchstart','scroll'].forEach(name=>addEventListener(name,reset,{passive:true}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  sb.auth.onAuthStateChange((_event,current)=>{if(current){reset();if(!timer)timer=setInterval(update,30000);}else{clearInterval(timer);timer=null;ensureBadge().textContent='';}});
  sb.auth.getSession().then(({data})=>{if(data.session){reset();timer=setInterval(update,30000);}});
})();