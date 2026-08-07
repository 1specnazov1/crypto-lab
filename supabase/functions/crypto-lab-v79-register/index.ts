import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://1specnazov1.github.io"]);
const ALLOWED_HOSTNAMES = new Set(["1specnazov1.github.io"]);
const REQUIRED_LEGAL_KEYS = ["terms", "privacy", "refund", "risk"] as const;
const REDIRECT_TO = "https://1specnazov1.github.io/crypto-lab/v79/app.html?route=account&auth=confirmed";
const MAX_BODY_BYTES = 16_000;
const MAX_CAPTCHA_TOKEN = 2_048;
const SITEVERIFY_TIMEOUT_MS = 10_000;

function cors(origin: string) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" }; }
function reply(body: unknown, status: number, origin: string) { return Response.json(body, { status, headers: { ...cors(origin), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
function clean(value: unknown, max: number) { return String(value ?? "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max); }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function strongPassword(value: string) { return value.length >= 10 && value.length <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && !/[\u0000-\u001f\u007f]/.test(value); }
function legalReady(documents: Array<{ key: string; version: string }>) { if (documents.length !== REQUIRED_LEGAL_KEYS.length) return false; const keys = new Set(documents.map((document) => document.key)); return REQUIRED_LEGAL_KEYS.every((key) => keys.has(key)); }
async function hmac(value: string, key: string) { const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)); return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function clientIp(request: Request) { return clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80); }

async function validateTurnstile(secret: string, token: string, remoteIp: string, requestId: string | undefined) {
  const form = new FormData(); form.append("secret", secret); form.append("response", token); if (remoteIp !== "unknown") form.append("remoteip", remoteIp); if (requestId) form.append("idempotency_key", requestId);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: controller.signal });
    const body = await response.json().catch(() => ({ success: false }));
    const hostname = String(body?.hostname || ""); const action = String(body?.action || "");
    return { valid: response.ok && body?.success === true && ALLOWED_HOSTNAMES.has(hostname) && action === "crypto_register", reason: clean((body?.["error-codes"] || []).join(",") || (!response.ok ? `siteverify_http_${response.status}` : "verification_failed"), 240) };
  } catch (error) { return { valid: false, reason: error instanceof DOMException && error.name === "AbortError" ? "siteverify_timeout" : "siteverify_unavailable" }; }
  finally { clearTimeout(timeout); }
}

async function mailReadiness(admin: ReturnType<typeof createClient>) {
  const resendReady = !!Deno.env.get("RESEND_API_KEY")?.trim() && !!Deno.env.get("CRYPTO_MAIL_FROM")?.trim();
  if (resendReady) return { ready: true, provider: "resend" };
  const relayUrl = Deno.env.get("CRYPTO_MAIL_RELAY_URL")?.trim() || "";
  const relayPublishableKey = Deno.env.get("CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY")?.trim() || "";
  if (!relayUrl || !relayPublishableKey) return { ready: false, provider: "none" };
  const { data: relaySecret } = await admin.rpc("get_service_secret", { p_name: "crypto_lab_mail_relay" });
  const ready = typeof relaySecret === "string" && relaySecret.length >= 24;
  return { ready, provider: ready ? "relay" : "none" };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") { if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 }); return new Response(null, { status: 204, headers: cors(origin) }); }
  if (!ALLOWED_ORIGINS.has(origin)) return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
  if (!supabaseUrl || !serviceRoleKey) return reply({ ok: false, error: "Server configuration unavailable" }, 503, origin);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: legalDocs, error: legalError } = await admin.from("crypto_legal_documents").select("document_key,version,effective_at,url_path").eq("active", true).order("document_key");
  if (legalError) return reply({ ok: false, error: "Legal configuration unavailable" }, 503, origin);
  const documents = (legalDocs || []).map((document) => ({ key: document.document_key, version: document.version, effective_at: document.effective_at, url: document.url_path }));
  const completeLegalSet = legalReady(documents);

  const siteKey = Deno.env.get("CRYPTO_TURNSTILE_SITE_KEY")?.trim() || "";
  const turnstileSecret = Deno.env.get("CRYPTO_TURNSTILE_SECRET_KEY")?.trim() || "";
  const mail = await mailReadiness(admin);
  const featureFlag = Deno.env.get("CRYPTO_PUBLIC_REGISTRATION_ENABLED") === "true";
  const enabled = featureFlag && !!siteKey && !!turnstileSecret && mail.ready && completeLegalSet;

  if (request.method === "GET") return reply({ ok: true, enabled, captcha_provider: "turnstile", site_key: enabled ? siteKey : null, captcha_action: "crypto_register", password_min_length: 10, required_legal_keys: REQUIRED_LEGAL_KEYS, documents, readiness: { feature_flag: featureFlag, turnstile: !!siteKey && !!turnstileSecret, mail_provider: mail.ready, mail_provider_code: mail.provider, legal_documents: completeLegalSet } }, 200, origin);
  if (request.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405, origin);
  if (!enabled) return reply({ ok: false, error: "Registration is temporarily unavailable", code: "REGISTRATION_DISABLED" }, 503, origin);
  const declaredLength = Number(request.headers.get("content-length") || 0); if (declaredLength > MAX_BODY_BYTES) return reply({ ok: false, error: "Request is too large" }, 413, origin);

  let requestId: string | undefined;
  const finish = async (outcome: string, reason?: string, userId?: string) => { if (!requestId) return; await admin.rpc("finish_crypto_registration_attempt", { p_request_id: requestId, p_outcome: outcome, p_reason: reason || null, p_user_id: userId || null }); };

  try {
    const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return reply({ ok: false, error: "Request is too large" }, 413, origin);
    const body = JSON.parse(raw || "{}");
    const email = clean(body.email, 254).toLowerCase(); const password = String(body.password ?? ""); const displayName = clean(body.display_name, 80);
    const requestedLocale = clean(body.locale, 2); const locale = ["ru", "uk", "en"].includes(requestedLocale) ? requestedLocale : "ru"; const timezone = clean(body.timezone, 80) || "Europe/Kyiv";
    const captcha = clean(body.captcha_token, MAX_CAPTCHA_TOKEN); const honeypot = clean(body.website, 200);
    const submitted = Array.isArray(body.legal_acceptances) ? body.legal_acceptances : [];
    const submittedMap = new Map(submitted.map((item: Record<string, unknown>) => [clean(item?.key, 20), clean(item?.version, 40)]));
    const legalCurrent = completeLegalSet && documents.every((document) => submittedMap.get(document.key) === document.version);

    const ip = clientIp(request); const ipHash = await hmac(`ip:${ip}`, serviceRoleKey); const emailHash = await hmac(`email:${email}`, serviceRoleKey); const userAgentHash = await hmac(`ua:${clean(request.headers.get("user-agent"), 500)}`, serviceRoleKey);
    const { data: reservation, error: reservationError } = await admin.rpc("reserve_crypto_registration_attempt", { p_ip_hash: ipHash, p_email_hash: emailHash }); if (reservationError) throw reservationError;
    requestId = reservation?.request_id;
    if (!reservation?.allowed) return reply({ ok: false, error: "Too many registration attempts", code: "RATE_LIMITED", retry_after: 3600 }, 429, origin);
    if (honeypot) { await finish("honeypot", "honeypot"); return reply({ ok: true, status: "confirmation_pending" }, 202, origin); }
    if (!validEmail(email) || !strongPassword(password)) { await finish("invalid_input", "validation"); return reply({ ok: false, error: "Check email and password requirements", code: "INVALID_INPUT" }, 400, origin); }
    if (!legalCurrent) { await finish("invalid_input", "legal_consent"); return reply({ ok: false, error: "Current legal documents must be accepted", code: "LEGAL_CONSENT_REQUIRED", documents }, 409, origin); }
    if (!captcha || captcha.length > MAX_CAPTCHA_TOKEN) { await finish("captcha_failed", "missing_or_oversized_token"); return reply({ ok: false, error: "CAPTCHA verification required", code: "CAPTCHA_REQUIRED" }, 400, origin); }
    const captchaResult = await validateTurnstile(turnstileSecret, captcha, ip, requestId); if (!captchaResult.valid) { await finish("captcha_failed", captchaResult.reason); return reply({ ok: false, error: "CAPTCHA verification failed", code: "CAPTCHA_FAILED" }, 400, origin); }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "signup", email, password, options: { data: { display_name: displayName || null, language: locale, timezone }, redirectTo: REDIRECT_TO } });
    if (linkError) { const message = String(linkError.message || "").toLowerCase(); if (message.includes("already") || message.includes("registered") || message.includes("exists")) { await finish("duplicate", "existing_email"); return reply({ ok: true, status: "confirmation_pending" }, 202, origin); } throw linkError; }
    const actionUrl = linkData?.properties?.action_link; const userId = linkData?.user?.id; if (!actionUrl || !userId) throw new Error("Confirmation link unavailable");

    try { for (const document of documents) { const { error } = await admin.rpc("service_accept_crypto_legal", { p_user_id: userId, p_document_key: document.key, p_document_version: document.version, p_locale: locale, p_source: "registration", p_ip_hash: ipHash, p_user_agent_hash: userAgentHash }); if (error) throw error; } }
    catch (error) { await admin.auth.admin.deleteUser(userId).catch(() => {}); await finish("internal_error", "legal_acceptance_failed"); throw error; }

    const mailResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-lab-mail-dispatch`, { method: "POST", headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, "Content-Type": "application/json" }, body: JSON.stringify({ to: email, template: "signup_confirmation", locale, action_url: actionUrl, idempotency_key: `signup-${requestId}` }) });
    const mailBody = await mailResponse.json().catch(() => ({}));
    if (!mailResponse.ok || !mailBody?.ok) { await admin.auth.admin.deleteUser(userId).catch(() => {}); await finish("mail_failed", clean(mailBody?.error || `mail_http_${mailResponse.status}`, 240)); return reply({ ok: false, error: "Confirmation email could not be sent", code: "MAIL_UNAVAILABLE" }, 503, origin); }

    await finish("accepted", undefined, userId); admin.from("crypto_registration_attempts").delete().lt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).then(() => {});
    return reply({ ok: true, status: "confirmation_pending" }, 202, origin);
  } catch (error) {
    console.error("crypto-lab-v79-register", error instanceof Error ? error.message : String(error)); await finish("internal_error", clean(error instanceof Error ? error.message : String(error), 240));
    return reply({ ok: false, error: "Registration is temporarily unavailable", code: "INTERNAL_ERROR" }, 500, origin);
  }
});
