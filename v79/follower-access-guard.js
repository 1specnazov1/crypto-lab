'use strict';
(() => {
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-x-auth-check';
  const AUTH_BASE='https://txhzxbizjpinowepfjkm.supabase.co/auth/v1';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const AUTH_KEY='sb-txhzxbizjpinowepfjkm-auth-token';
  const TARGET='@CryptoLabPulse';
  const TARGET_URL='https://x.com/CryptoLabPulse';
  const onApp=/\/app\.html$/.test(location.pathname)||/\/v79\/?$/.test(location.pathname);
  const query=new URLSearchParams(location.search);
  const smoke=query.get('follower-gate-smoke')==='1';
  const protectedSignalRoute=query.get('route')==='scanner'||/\/scanner\.html$/.test(location.pathname);
  if(!protectedSignalRoute){
    if(!localStorage.getItem('cryptoLabLanguage'))localStorage.setItem('cryptoLabLanguage','en');
    return;
  }
  if((location.hostname==='127.0.0.1'||location.hostname==='localhost')&&!smoke){
    if(!localStorage.getItem('cryptoLabLanguage'))localStorage.setItem('cryptoLabLanguage','en');
    return;
  }
  if(!localStorage.getItem('cryptoLabLanguage'))localStorage.setItem('cryptoLabLanguage','en');
  document.documentElement.lang=localStorage.getItem('cryptoLabLanguage')||'en';

  function stored(){
    try{
      const raw=localStorage.getItem(AUTH_KEY);if(!raw)return null;
      const value=JSON.parse(raw);
      if(Array.isArray(value)&&value[0]?.access_token)return{value,session:value[0],shape:'array'};
      if(value?.currentSession?.access_token)return{value,session:value.currentSession,shape:'currentSession'};
      if(value?.session?.access_token)return{value,session:value.session,shape:'session'};
      if(value?.access_token)return{value,session:value,shape:'direct'};
      return null;
    }catch{return null}
  }
  function expiryMs(session){
    const n=Number(session?.expires_at||0);if(n>0)return n*1000;
    try{
      const raw=String(session?.access_token||'').split('.')[1]||'';
      const padded=raw.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(raw.length/4)*4,'=');
      const payload=JSON.parse(atob(padded));
      return Number(payload?.exp||0)*1000;
    }catch{return 0}
  }
  function persist(record,next){
    try{
      let out;
      if(record.shape==='array'){out=[...record.value];out[0]=next}
      else if(record.shape==='currentSession')out={...record.value,currentSession:next};
      else if(record.shape==='session')out={...record.value,session:next};
      else out=next;
      localStorage.setItem(AUTH_KEY,JSON.stringify(out));
    }catch{}
  }
  async function freshSession(force=false){
    const record=stored();if(!record)return null;
    const current=record.session,expires=expiryMs(current);
    if(!force&&(!expires||expires>Date.now()+60000))return current;
    if(!current.refresh_token)return null;
    try{
      const response=await fetch(`${AUTH_BASE}/token?grant_type=refresh_token`,{
        method:'POST',headers:{apikey:APIKEY,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:current.refresh_token}),cache:'no-store'
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body?.access_token||!body?.refresh_token)return null;
      const next={...current,...body};persist(record,next);return next;
    }catch{return null}
  }

  const style=document.createElement('style');style.id='cryptoFollowerGuardStyles';style.textContent=`
    .xfg{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:20px;background:rgba(5,8,12,.975);backdrop-filter:blur(12px);overflow:auto;color:#eaecef;font:14px Inter,system-ui,sans-serif}
    .xfg-card{width:min(600px,100%);background:#12171d;border:1px solid #343b45;border-radius:18px;padding:26px;box-shadow:0 28px 90px #000c}
    .xfg-brand{font-weight:950;letter-spacing:.08em;color:#f0b90b;margin-bottom:14px}.xfg-card h2{font-size:25px;margin:0 0 10px}.xfg-card p{color:#aab3bf;line-height:1.6;margin:8px 0 14px}.xfg-note{padding:11px;border:1px solid #2b3139;background:#0d1117;border-radius:10px;font-size:11px;color:#8e99a8!important}.xfg-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.xfg button,.xfg a{display:grid;place-items:center;min-height:46px;border-radius:9px;padding:10px 12px;font-weight:850;text-decoration:none;cursor:pointer}.xfg-follow{background:#fff;color:#111;border:1px solid #fff}.xfg-verify{background:#f0b90b;color:#111;border:1px solid #f0b90b}.xfg-secondary{grid-column:1/-1;background:#1e2329;color:#fff;border:1px solid #343b45}.xfg-status{min-height:18px;color:#ffd37a!important;font-size:11px}.xfg-ok{color:#a7f3d0!important}@media(max-width:520px){.xfg{padding:12px;place-items:start center}.xfg-card{padding:20px;margin-top:10px}.xfg-actions{grid-template-columns:1fr}}
  `;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let session=null,gate=null;
  function ensureGate(){
    if(!document.getElementById(style.id))document.head.appendChild(style);
    if(!gate){gate=document.createElement('div');gate.className='xfg';gate.id='cryptoFollowerGuard';document.body.appendChild(gate)}
    return gate;
  }
  function render(opts={}){
    ensureGate();
    const connected=opts.connected!==false,username=opts.username?`@${String(opts.username).replace(/^@/,'')}`:'',code=opts.code||'',status=opts.status||'',signed=!!session;
    gate.innerHTML=`<div class="xfg-card"><div class="xfg-brand">CRYPTO LAB · PROTECTED SIGNALS</div><h2>${signed?'Verify signal access':'Sign in required'}</h2><p>${signed?`Protected CRYPTO LAB signals are available to verified followers of <b>${TARGET}</b>. Verify your X account to continue.`:'Sign in to your CRYPTO LAB account before opening protected signals.'}</p>${username?`<p class="xfg-note">Connected X account: <b>${esc(username)}</b>${code==='FOLLOW_REQUIRED'?' · Follow @CryptoLabPulse, then verify access again.':''}</p>`:`<p class="xfg-note">${signed?'Verification uses secure X authorization and the X API. Your X authorization tokens are encrypted server-side.':'The public CRYPTO LAB homepage remains available without authorization.'}</p>`}<p class="xfg-status" id="xfgStatus">${esc(status)}</p><div class="xfg-actions">${signed?`<a class="xfg-follow" href="${TARGET_URL}" target="_blank" rel="noopener">Follow ${TARGET}</a><button class="xfg-verify" id="xfgVerify">Verify X Access</button><button class="xfg-secondary" id="xfgAccount">CRYPTO LAB account</button>`:`<a class="xfg-verify xfg-secondary" href="./account.html?login=1" target="_top">Sign in to CRYPTO LAB</a>`}</div></div>`;
    if(session){document.getElementById('xfgVerify').onclick=()=>connected?check(true):start();document.getElementById('xfgAccount').onclick=()=>{location.href='./account.html?login=1'}}
  }
  async function call(body,retry=true){
    if(!session)return{response:{ok:false,status:401},body:{error:'Authentication required'}};
    let response=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}),result=await response.json().catch(()=>({}));
    if(response.status===401&&retry){const refreshed=await freshSession(true);if(refreshed){session=refreshed;response=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});result=await response.json().catch(()=>({}))}}
    return{response,body:result};
  }
  async function start(){
    const node=document.getElementById('xfgStatus');if(node)node.textContent='Opening secure X verification…';
    try{const {response,body}=await call({action:'start'});if(response.status===401){session=null;return render({connected:false,status:'Session expired. Sign in again.'})}if(!response.ok||!body?.authorize_url)throw new Error(body?.error||'Could not start X verification');location.href=body.authorize_url}catch(error){if(node)node.textContent=error instanceof Error?error.message:'Could not start X verification'}
  }
  async function check(force=false){
    const node=document.getElementById('xfgStatus');if(node)node.textContent='Checking follower status…';
    try{
      const {response,body}=await call({action:'status',force});
      if(response.status===401){session=null;return render({connected:false,status:'Session expired. Sign in again.'})}
      if(response.ok&&body?.allowed){gate?.remove();style.remove();document.body.dataset.xFollowerAccess=body.stale?'stale':'verified';return}
      if(body?.code==='X_NOT_CONNECTED'||body?.connect_required)return render({connected:false,code:body?.code,status:'Verify your X account to open protected signals.'});
      if(body?.code==='FOLLOW_REQUIRED')return render({connected:true,username:body?.x_username,code:body.code,status:`Follow ${TARGET}, then press Verify X Access.`});
      render({connected:!body?.connect_required,username:body?.x_username,code:body?.code,status:body?.error||'Follower verification is required.'});
    }catch{render({connected:true,status:'Follower verification is temporarily unavailable. Please retry.'})}
  }
  (async()=>{
    session=await freshSession(false);
    if(!session){if(onApp)return;return render({connected:false,status:'Sign in to continue.'})}
    const qp=new URLSearchParams(location.search),xResult=qp.get('x_access');
    if(xResult)history.replaceState(null,'',location.pathname+(qp.get('route')?`?route=${encodeURIComponent(qp.get('route'))}`:''));
    render({connected:true,status:xResult==='verified'?'X connected. Confirming follower status…':xResult==='follow_required'?`X connected. Follow ${TARGET}, then recheck.`:xResult==='denied'?'X authorization was cancelled.':''});
    check(xResult==='verified'||xResult==='follow_required');
  })();
})();
