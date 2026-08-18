import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://1specnazov1.github.io";
const HOST="1specnazov1.github.io";
const VERIFY_PAGE="https://1specnazov1.github.io/crypto-lab/v79/access-verify.html";
const LEGAL=["terms","privacy","risk"];
const TTL_MINUTES=30;
const MAX_BODY=16000;

function cors(origin:string){return {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"content-type, x-client-info, authorization, apikey","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Max-Age":"86400",Vary:"Origin"};}
function json(body:unknown,status:number,origin:string){return Response.json(body,{status,headers:{...cors(origin),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}})}
function clean(v:unknown,n:number){return String(v??"").replace(/[\r\n\u0000-\u001f\u007f]+/g," ").trim().slice(0,n)}
function validEmail(v:string){return v.length>2&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function validHex64(v:string){return /^[0-9a-f]{64}$/.test(v)}
function validSecret(v:string){return v.length>=32&&v.length<=128&&/^[A-Za-z0-9_-]+$/.test(v)}
function validToken(v:string){return v.length>=32&&v.length<=128&&/^[A-Za-z0-9_-]+$/.test(v)}
function validUuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
function ip(req:Request){return clean(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",80)}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function hmac(value:string,keyText:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(keyText),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function randomToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
function maskEmail(value:string){const [local,domain]=value.split("@");if(!local||!domain)return "***";const shown=local.length<=2?local[0]||"*":local.slice(0,2);return `${shown}${"*".repeat(Math.min(6,Math.max(2,local.length-shown.length)))}@${domain}`}
async function verifyCaptcha(secret:string,token:string,remote:string){const f=new FormData();f.append("secret",secret);f.append("response",token);if(remote!=="unknown")f.append("remoteip",remote);try{const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:f});const b=await r.json().catch(()=>({}));return r.ok&&b?.success===true&&String(b?.hostname||"")===HOST&&String(b?.action||"")==="crypto_access_request"}catch{return false}}
function mailCopy(locale:string){if(locale==="uk")return {subject:"Ваш доступ до CRYPTO LAB",title:"Доступ до CRYPTO LAB",body:"Ви запросили вхід до CRYPTO LAB. Відкрийте кнопку на тому самому пристрої та в тому самому браузері, де вводили email.",warning:"Посилання прив’язане до браузера. Якщо його переслати іншій людині, на іншому пристрої воно не дасть доступ.",button:"Відкрити CRYPTO LAB",expires:`Посилання дійсне ${TTL_MINUTES} хвилин.`};if(locale==="en")return {subject:"Your CRYPTO LAB access",title:"Access CRYPTO LAB",body:"You requested access to CRYPTO LAB. Open the button on the same device and in the same browser where you entered your email.",warning:"This link is browser-bound. Forwarding it to another person or opening it on another device will not grant access.",button:"Open CRYPTO LAB",expires:`The link is valid for ${TTL_MINUTES} minutes.`};return {subject:"Ваш доступ к CRYPTO LAB",title:"Доступ к CRYPTO LAB",body:"Вы запросили вход в CRYPTO LAB. Откройте кнопку на том же устройстве и в том же браузере, где вводили email.",warning:"Ссылка привязана к браузеру. Если её переслать другому человеку, на другом устройстве она не даст доступ.",button:"Открыть CRYPTO LAB",expires:`Ссылка действует ${TTL_MINUTES} минут.`}}
async function sendAccessMail(apiKey:string,from:string,to:string,locale:string,link:string,grantId:string){const c=mailCopy(locale);const text=`${c.title}\n\n${c.body}\n\n${c.warning}\n\n${c.button}: ${link}\n\n${c.expires}`;const html=`<!doctype html><html><body style="margin:0;background:#0b0e11;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #2b3139;border-radius:16px;background:#12171d;padding:28px"><div style="font-weight:900;color:#f0b90b;font-size:19px;margin-bottom:18px">CRYPTO LAB</div><h1 style="font-size:23px;color:#fff;margin:0 0 16px">${escapeHtml(c.title)}</h1><p style="color:#d8dee9;line-height:1.6">${escapeHtml(c.body)}</p><p style="color:#ffd37a;line-height:1.6;border:1px solid #f0b90b55;background:#f0b90b10;border-radius:10px;padding:12px">${escapeHtml(c.warning)}</p><p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#f0b90b;color:#111;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:800">${escapeHtml(c.button)}</a></p><p style="color:#848e9c;font-size:12px;line-height:1.5">${escapeHtml(c.expires)}<br>${escapeHtml(maskEmail(to))}</p></div></div></body></html>`;const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","User-Agent":"crypto-lab-v79-access/5","Idempotency-Key":`email-access-${grantId}`},body:JSON.stringify({from,to:[to],subject:c.subject,text,html}),redirect:"error"});const b=await r.json().catch(()=>({}));return r.ok&&!!b?.id}

Deno.serve(async req=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS"){if(origin!==ORIGIN)return new Response(null,{status:403});return new Response(null,{status:204,headers:cors(origin)})}
  if(origin!==ORIGIN)return Response.json({ok:false,error:"Origin not allowed"},{status:403});
  const supa=Deno.env.get("SUPABASE_URL")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",siteKey=Deno.env.get("CRYPTO_TURNSTILE_SITE_KEY")||"",turnSecret=Deno.env.get("CRYPTO_TURNSTILE_SECRET_KEY")||"",resend=Deno.env.get("RESEND_API_KEY")||"",from=Deno.env.get("CRYPTO_MAIL_FROM")||"";
  if(!supa||!service)return json({ok:false,error:"Server configuration unavailable"},503,origin);
  const admin=createClient(supa,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:docs,error:docErr}=await admin.from("crypto_legal_documents").select("document_key,version,effective_at,url_path").eq("active",true).in("document_key",LEGAL).order("document_key");
  const documents=(docs||[]).map((d:any)=>({key:d.document_key,version:d.version,effective_at:d.effective_at,url:d.url_path}));
  const legalReady=!docErr&&documents.length===LEGAL.length&&LEGAL.every(k=>documents.some((d:any)=>d.key===k));

  if(req.method==="GET"){
    const requestUrl=new URL(req.url),legacyInvite=clean(requestUrl.searchParams.get("invite"),256);
    if(legacyInvite){if(!validToken(legacyInvite))return json({ok:true,mode:"invite_only_free",invite_valid:false},200,origin);const hash=await sha256(legacyInvite);const {data}=await admin.from("crypto_access_requests").select("id,email,status,invite_expires_at,activated_at,claimed_user_id").eq("invite_token_hash",hash).maybeSingle();if(!data)return json({ok:true,mode:"invite_only_free",invite_valid:false},200,origin);const expired=!data.invite_expires_at||new Date(data.invite_expires_at).getTime()<=Date.now();const valid=data.status==="invited"&&!expired&&!data.activated_at&&!data.claimed_user_id;return json({ok:true,mode:"invite_only_free",invite_valid:valid,masked_email:valid?maskEmail(data.email):null,site_key:valid?siteKey:null,captcha_action:"crypto_register",free_access:true},200,origin)}
    return json({ok:true,mode:"email_bound",request_enabled:!!siteKey&&!!turnSecret&&!!resend&&!!from&&legalReady,site_key:siteKey||null,captcha_action:"crypto_access_request",expires_minutes:TTL_MINUTES,device_bound:true,required_legal_keys:LEGAL,documents},200,origin);
  }
  if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405,origin);
  const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX_BODY)return json({ok:false,error:"Request too large"},413,origin);
  let body:any;try{body=JSON.parse(raw||"{}") }catch{return json({ok:false,error:"Invalid JSON"},400,origin)}
  const action=clean(body.action,24);

  if(action==="request"){
    const email=clean(body.email,254).toLowerCase(),locale=["ru","uk","en"].includes(clean(body.locale,2))?clean(body.locale,2):"ru",deviceHash=clean(body.device_hash,64).toLowerCase(),captchaToken=clean(body.captcha_token,2048),honeypot=clean(body.website,200),submitted=Array.isArray(body.legal_acceptances)?body.legal_acceptances:[];
    if(honeypot)return json({ok:true,status:"sent"},202,origin);
    if(!validEmail(email))return json({ok:false,error:"Введите корректный email",code:"INVALID_EMAIL"},400,origin);
    if(!validHex64(deviceHash))return json({ok:false,error:"Browser security check failed",code:"DEVICE_REQUIRED"},400,origin);
    if(!siteKey||!turnSecret||!resend||!from||!legalReady)return json({ok:false,error:"Email access is temporarily unavailable"},503,origin);
    const legalMap=new Map(submitted.map((x:any)=>[clean(x?.key,20),clean(x?.version,40)]));if(!documents.every((d:any)=>legalMap.get(d.key)===d.version))return json({ok:false,error:"Current legal documents must be accepted",code:"LEGAL_CONSENT_REQUIRED",documents},409,origin);
    const remote=ip(req);if(!captchaToken||!await verifyCaptcha(turnSecret,captchaToken,remote))return json({ok:false,error:"CAPTCHA verification failed",code:"CAPTCHA_FAILED"},400,origin);
    const ipHash=await hmac(`ip:${remote}`,service),uaHash=await hmac(`ua:${clean(req.headers.get("user-agent"),500)}`,service),hourAgo=new Date(Date.now()-3600000).toISOString(),minuteAgo=new Date(Date.now()-60000).toISOString();
    const [{count:ipCount},{count:emailCount},{data:recent}]=await Promise.all([admin.from("crypto_email_access_grants").select("id",{count:"exact",head:true}).eq("request_ip_hash",ipHash).gte("created_at",hourAgo),admin.from("crypto_email_access_grants").select("id",{count:"exact",head:true}).eq("email",email).gte("created_at",hourAgo),admin.from("crypto_email_access_grants").select("id,created_at").eq("email",email).gte("created_at",minuteAgo).order("created_at",{ascending:false}).limit(1).maybeSingle()]);
    if((ipCount||0)>=10||(emailCount||0)>=5||recent)return json({ok:false,error:"Слишком много запросов. Попробуйте немного позже.",code:"RATE_LIMITED"},429,origin);
    const token=randomToken(),tokenHash=await sha256(token),expires=new Date(Date.now()+TTL_MINUTES*60000).toISOString(),legalAcceptances=documents.map((d:any)=>({key:d.key,version:d.version}));
    const {data:grant,error:insErr}=await admin.from("crypto_email_access_grants").insert({email,locale,token_hash:tokenHash,device_hash:deviceHash,request_ip_hash:ipHash,request_user_agent_hash:uaHash,legal_acceptances:legalAcceptances,expires_at:expires}).select("id").single();if(insErr||!grant)throw insErr||new Error("Grant create failed");
    const link=`${VERIFY_PAGE}#t=${encodeURIComponent(token)}`;const sent=await sendAccessMail(resend,from,email,locale,link,grant.id);if(!sent){await admin.from("crypto_email_access_grants").delete().eq("id",grant.id);return json({ok:false,error:"Письмо не удалось отправить. Попробуйте позже.",code:"MAIL_UNAVAILABLE"},503,origin)}
    await Promise.all([admin.from("crypto_email_access_grants").update({email_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",grant.id),admin.from("crypto_email_access_grants").update({revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("email",email).is("used_at",null).is("revoked_at",null).neq("id",grant.id)]);
    return json({ok:true,status:"sent",expires_minutes:TTL_MINUTES,device_bound:true,masked_email:maskEmail(email)},202,origin);
  }

  if(action==="redeem"){
    const token=clean(body.token,128),deviceSecret=clean(body.device_secret,128);if(!validToken(token)||!validSecret(deviceSecret))return json({ok:false,error:"Ссылка недействительна",code:"INVALID_LINK"},400,origin);
    const tokenHash=await sha256(token),deviceHash=await sha256(deviceSecret);const {data:grant}=await admin.from("crypto_email_access_grants").select("*").eq("token_hash",tokenHash).maybeSingle();if(!grant)return json({ok:false,error:"Ссылка недействительна или уже истекла",code:"INVALID_LINK"},404,origin);
    if(grant.revoked_at||grant.used_at||new Date(grant.expires_at).getTime()<=Date.now())return json({ok:false,error:"Ссылка уже использована или истекла",code:"LINK_EXPIRED"},410,origin);
    const attempts=Number(grant.redeem_attempts||0)+1;await admin.from("crypto_email_access_grants").update({redeem_attempts:attempts,updated_at:new Date().toISOString()}).eq("id",grant.id);if(attempts>6){await admin.from("crypto_email_access_grants").update({revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",grant.id);return json({ok:false,error:"Ссылка заблокирована после нескольких неверных попыток",code:"LINK_LOCKED"},423,origin)}
    if(deviceHash!==grant.device_hash)return json({ok:false,error:"Эта ссылка привязана к другому браузеру. Откройте её на устройстве, где вводили email, или запросите новую.",code:"DEVICE_MISMATCH"},403,origin);
    const stored=Array.isArray(grant.legal_acceptances)?grant.legal_acceptances:[],storedMap=new Map(stored.map((x:any)=>[clean(x?.key,20),clean(x?.version,40)]));if(!legalReady||!documents.every((d:any)=>storedMap.get(d.key)===d.version))return json({ok:false,error:"Документы обновились. Запросите новую ссылку и подтвердите актуальные условия.",code:"LEGAL_UPDATED"},409,origin);
    const {data:link,error:linkErr}=await admin.auth.admin.generateLink({type:"magiclink",email:grant.email,options:{data:{language:grant.locale,timezone:"Europe/Kyiv",access_source:"email_bound"}}});if(linkErr)throw linkErr;const hashed=link?.properties?.hashed_token,userId=link?.user?.id;if(!hashed||!userId)throw new Error("Auth token unavailable");
    for(const d of documents){const {error}=await admin.rpc("service_accept_crypto_legal",{p_user_id:userId,p_document_key:d.key,p_document_version:d.version,p_locale:grant.locale,p_source:"registration",p_ip_hash:grant.request_ip_hash,p_user_agent_hash:grant.request_user_agent_hash});if(error)throw error}
    await admin.from("crypto_email_access_grants").update({user_id:userId,redeem_started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",grant.id);return json({ok:true,status:"verified_device",grant_id:grant.id,token_hash:hashed,email_masked:maskEmail(grant.email)},200,origin);
  }

  if(action==="claim"){
    const grantId=clean(body.grant_id,64),auth=req.headers.get("authorization")||"";if(!validUuid(grantId)||!/^Bearer\s+\S+/i.test(auth))return json({ok:false,error:"Authentication required",code:"AUTH_REQUIRED"},401,origin);
    const jwt=auth.replace(/^Bearer\s+/i,"");const {data:u,error:uErr}=await admin.auth.getUser(jwt);const user=u?.user;if(uErr||!user?.id||!user.email)return json({ok:false,error:"Authentication required",code:"AUTH_REQUIRED"},401,origin);
    const {data:grant}=await admin.from("crypto_email_access_grants").select("id,email,user_id,used_at,revoked_at,redeem_started_at").eq("id",grantId).maybeSingle();if(!grant||grant.revoked_at||grant.used_at||grant.user_id!==user.id||grant.email!==user.email.toLowerCase())return json({ok:false,error:"Access grant mismatch",code:"GRANT_MISMATCH"},403,origin);
    if(!grant.redeem_started_at||new Date(grant.redeem_started_at).getTime()<Date.now()-10*60000)return json({ok:false,error:"Access confirmation expired",code:"CLAIM_EXPIRED"},410,origin);
    await admin.from("crypto_email_access_grants").update({used_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",grant.id).is("used_at",null);return json({ok:true,status:"activated",user_id:user.id,email:user.email},200,origin);
  }
  return json({ok:false,error:"Invalid action"},400,origin);
});
