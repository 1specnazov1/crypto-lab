'use strict';
(() => {
  const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-x-auth-check';
  const APIKEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const AUTH_KEY='sb-txhzxbizjpinowepfjkm-auth-token';
  const TARGET='@CryptoLabPulse';
  const TARGET_URL='https://x.com/CryptoLabPulse';
  const onApp=/\/app\.html$/.test(location.pathname)||/\/v79\/?$/.test(location.pathname);
  if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){
    if(!localStorage.getItem('cryptoLabLanguage'))localStorage.setItem('cryptoLabLanguage','en');
    return;
  }
  if(!localStorage.getItem('cryptoLabLanguage'))localStorage.setItem('cryptoLabLanguage','en');
  document.documentElement.lang=localStorage.getItem('cryptoLabLanguage')||'en';
  function session(){try{const raw=localStorage.getItem(AUTH_KEY);if(!raw)return null;const v=JSON.parse(raw);const s=Array.isArray(v)?v[0]:v?.currentSession||v?.session||v;return s?.access_token?s:null}catch{return null}}
  const s=session();
  if(!s&&onApp)return;
  const style=document.createElement('style');style.id='cryptoFollowerGuardStyles';style.textContent=`
    .xfg{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:20px;background:rgba(5,8,12,.975);backdrop-filter:blur(12px);overflow:auto;color:#eaecef;font:14px Inter,system-ui,sans-serif}
    .xfg-card{width:min(600px,100%);background:#12171d;border:1px solid #343b45;border-radius:18px;padding:26px;box-shadow:0 28px 90px #000c}
    .xfg-brand{font-weight:950;letter-spacing:.08em;color:#f0b90b;margin-bottom:14px}.xfg-card h2{font-size:25px;margin:0 0 10px}.xfg-card p{color:#aab3bf;line-height:1.6;margin:8px 0 14px}.xfg-note{padding:11px;border:1px solid #2b3139;background:#0d1117;border-radius:10px;font-size:11px;color:#8e99a8!important}.xfg-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.xfg button,.xfg a{display:grid;place-items:center;min-height:46px;border-radius:9px;padding:10px 12px;font-weight:850;text-decoration:none;cursor:pointer}.xfg-follow{background:#fff;color:#111;border:1px solid #fff}.xfg-verify{background:#f0b90b;color:#111;border:1px solid #f0b90b}.xfg-secondary{grid-column:1/-1;background:#1e2329;color:#fff;border:1px solid #343b45}.xfg-status{min-height:18px;color:#ffd37a!important;font-size:11px}.xfg-ok{color:#a7f3d0!important}@media(max-width:520px){.xfg{padding:12px;place-items:start center}.xfg-card{padding:20px;margin-top:10px}.xfg-actions{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
  const gate=document.createElement('div');gate.className='xfg';gate.id='cryptoFollowerGuard';document.body.appendChild(gate);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(opts={}){const connected=opts.connected!==false,username=opts.username?`@${String(opts.username).replace(/^@/,'')}`:'',code=opts.code||'',status=opts.status||'';gate.innerHTML=`<div class="xfg-card"><div class="xfg-brand">CRYPTO LAB · FREE</div><h2>${s?'Follower access required':'Sign in required'}</h2><p>${s?`CRYPTO LAB is free for verified followers of <b>${TARGET}</b>. Connect your X account so the server can verify that you follow the account.`:'Sign in to your CRYPTO LAB account first. Access to the terminal is available only to verified followers of @CryptoLabPulse.'}</p>${username?`<p class="xfg-note">Connected X account: <b>${esc(username)}</b>${code==='FOLLOW_REQUIRED'?' · Follow @CryptoLabPulse, then recheck access.':''}</p>`:`<p class="xfg-note">We never accept a typed username as proof. Verification uses X authorization and the X API. Your X authorization tokens are encrypted server-side.</p>`}<p class="xfg-status" id="xfgStatus">${esc(status)}</p><div class="xfg-actions">${s?`<a class="xfg-follow" href="${TARGET_URL}" target="_blank" rel="noopener">Follow ${TARGET}</a><button class="xfg-verify" id="xfgVerify">${connected?'Recheck follower access':'Connect X & verify'}</button><button class="xfg-secondary" id="xfgAccount">CRYPTO LAB account</button>`:`<a class="xfg-verify" href="./app.html" target="_top">Open CRYPTO LAB sign in</a><a class="xfg-follow" href="${TARGET_URL}" target="_blank" rel="noopener">Follow ${TARGET}</a>`}</div></div>`;if(s){document.getElementById('xfgVerify').onclick=()=>connected?check(true):start();document.getElementById('xfgAccount').onclick=()=>{location.href='./account.html?login=1'}}}
  async function call(body){const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}),b=await r.json().catch(()=>({}));return {r,b}}
  async function start(){const node=document.getElementById('xfgStatus');if(node)node.textContent='Opening secure X verification…';try{const {r,b}=await call({action:'start'});if(!r.ok||!b?.authorize_url)throw new Error(b?.error||'Could not start X verification');location.href=b.authorize_url}catch(e){if(node)node.textContent=e instanceof Error?e.message:'Could not start X verification'}}
  async function check(force=false){const node=document.getElementById('xfgStatus');if(node)node.textContent='Checking follower status…';try{const {r,b}=await call({action:'status',force});if(r.ok&&b?.allowed){gate.remove();style.remove();document.body.dataset.xFollowerAccess=b.stale?'stale':'verified';return}if(b?.code==='X_NOT_CONNECTED'||b?.connect_required)return render({connected:false,code:b?.code,status:'Connect X to verify follower access.'});if(b?.code==='FOLLOW_REQUIRED')return render({connected:true,username:b?.x_username,code:b.code,status:`Follow ${TARGET}, then press Recheck follower access.`});render({connected:!b?.connect_required,username:b?.x_username,code:b?.code,status:b?.error||'Follower verification is required.'})}catch(e){render({connected:true,status:'Follower verification is temporarily unavailable. Please retry.'})}}
  if(!s)return render({connected:false});
  const qp=new URLSearchParams(location.search),xResult=qp.get('x_access');
  if(xResult){history.replaceState(null,'',location.pathname+(qp.get('route')?`?route=${encodeURIComponent(qp.get('route'))}`:''));}
  render({connected:true,status:xResult==='verified'?'X connected. Confirming follower status…':xResult==='follow_required'?`X connected. Follow ${TARGET}, then recheck.`:xResult==='denied'?'X authorization was cancelled.':''});
  check(xResult==='verified'||xResult==='follow_required');
})();