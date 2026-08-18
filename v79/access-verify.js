'use strict';
const ENDPOINT='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-lab-v79-access';
const PROJECT='https://txhzxbizjpinowepfjkm.supabase.co';
const KEY='sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
const DEVICE_KEY='cryptoLabEmailAccessDeviceV1';
const EMAIL_KEY='cryptoLabEmailAccessEmailV1';
const sb=supabase.createClient(PROJECT,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const box=document.getElementById('state'),retry=document.getElementById('retry');
function setState(text,type=''){box.textContent=text;box.className='state'+(type?' '+type:'')}
function tokenFromHash(){const raw=location.hash.startsWith('#')?location.hash.slice(1):location.hash;const p=new URLSearchParams(raw);return p.get('t')||''}
function errorText(code,fallback){if(code==='DEVICE_MISMATCH')return 'Эта ссылка открыта не в том браузере. Вернитесь на устройство и браузер, где вводили email, или запросите новую ссылку.';if(code==='LINK_EXPIRED'||code==='INVALID_LINK')return 'Ссылка уже использована, недействительна или истекла. Запросите новую.';if(code==='LINK_LOCKED')return 'Ссылка заблокирована после нескольких неверных попыток. Запросите новую.';if(code==='LEGAL_UPDATED')return 'Условия доступа обновились. Запросите новую ссылку и подтвердите актуальные документы.';return fallback||'Не удалось подтвердить доступ.'}
async function run(){const token=tokenFromHash();history.replaceState(null,'',location.pathname+location.search);const device=localStorage.getItem(DEVICE_KEY)||'';if(!token){setState('В ссылке отсутствует одноразовый токен. Запросите новую ссылку.','bad');retry.hidden=false;return}if(!device){setState('Этот браузер не запрашивал доступ. Пересланная ссылка здесь не работает. Откройте письмо в исходном браузере или запросите новую ссылку.','bad');retry.hidden=false;return}
 try{
  const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'redeem',token,device_secret:device}),cache:'no-store'}),b=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(b?.error||'Access verification failed'),{code:b?.code});
  if(!b?.token_hash||!b?.grant_id)throw new Error('Access token unavailable');
  setState('Браузер подтверждён. Создаю защищённую сессию…');
  const {data,error}=await sb.auth.verifyOtp({token_hash:b.token_hash,type:'email'});if(error||!data?.session)throw error||new Error('Session unavailable');
  const cr=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({action:'claim',grant_id:b.grant_id}),cache:'no-store'}),cb=await cr.json().catch(()=>({}));if(!cr.ok||!cb?.ok)throw Object.assign(new Error(cb?.error||'Access activation failed'),{code:cb?.code});
  localStorage.removeItem(DEVICE_KEY);localStorage.removeItem(EMAIL_KEY);setState('Доступ подтверждён. Открываю CRYPTO LAB…','ok');setTimeout(()=>location.replace('./app.html'),350);
 }catch(e){console.warn('email access verification failed',e);setState(errorText(e?.code,e?.message),'bad');retry.hidden=false}}
retry.onclick=()=>{localStorage.removeItem(DEVICE_KEY);location.replace('./app.html')};run();
