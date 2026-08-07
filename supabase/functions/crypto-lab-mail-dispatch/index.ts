import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BODY_BYTES = 24_000;
const ACTION_HOST = "txhzxbizjpinowepfjkm.supabase.co";
const ALLOWED_TEMPLATES = new Set(["signup_confirmation", "password_recovery"]);
const ALLOWED_LOCALES = new Set(["ru", "uk", "en"]);

const TEMPLATES: Record<string, Record<string, { subject: string; text: string; button: string }>> = {
  signup_confirmation: {
    ru: { subject: "Подтвердите email для CRYPTO LAB", text: "Вы начали создание аккаунта CRYPTO LAB. Подтвердите email по ссылке: {{action_url}}\n\nЕсли вы не создавали аккаунт, просто проигнорируйте это письмо. CRYPTO LAB не запрашивает seed-фразы, приватные ключи или пароли кошельков по email.", button: "Подтвердить email" },
    uk: { subject: "Підтвердьте email для CRYPTO LAB", text: "Ви розпочали створення акаунта CRYPTO LAB. Підтвердьте email за посиланням: {{action_url}}\n\nЯкщо ви не створювали акаунт, просто проігноруйте цей лист. CRYPTO LAB не запитує seed-фрази, приватні ключі або паролі гаманців через email.", button: "Підтвердити email" },
    en: { subject: "Confirm your email for CRYPTO LAB", text: "You started creating a CRYPTO LAB account. Confirm your email using this link: {{action_url}}\n\nIf you did not create an account, ignore this message. CRYPTO LAB never asks for seed phrases, private keys, or wallet passwords by email.", button: "Confirm email" },
  },
  password_recovery: {
    ru: { subject: "Восстановление доступа к CRYPTO LAB", text: "Получен запрос на восстановление доступа к CRYPTO LAB. Продолжить восстановление: {{action_url}}\n\nЕсли вы не запрашивали восстановление, проигнорируйте письмо. Никому не передавайте пароли, seed-фразы или приватные ключи.", button: "Восстановить доступ" },
    uk: { subject: "Відновлення доступу до CRYPTO LAB", text: "Отримано запит на відновлення доступу до CRYPTO LAB. Продовжити відновлення: {{action_url}}\n\nЯкщо ви не запитували відновлення, проігноруйте лист. Нікому не передавайте паролі, seed-фрази або приватні ключі.", button: "Відновити доступ" },
    en: { subject: "Recover access to CRYPTO LAB", text: "A request was made to recover access to CRYPTO LAB. Continue recovery here: {{action_url}}\n\nIf you did not request recovery, ignore this message. Never share passwords, seed phrases, or private keys.", button: "Recover access" },
  },
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function timingSafeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a); const bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length; const length = Math.max(aa.length, bb.length);
  for (let index = 0; index < length; index++) diff |= (aa[index] ?? 0) ^ (bb[index] ?? 0);
  return diff === 0;
}
function clean(value: unknown, max: number) { return String(value ?? "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max); }
function validEmail(value: string) { return value.length > 2 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function safeActionUrl(value: string, template: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== ACTION_HOST || url.pathname !== "/auth/v1/verify") return false;
    const type = url.searchParams.get("type");
    if (template === "signup_confirmation" && type !== "signup") return false;
    if (template === "password_recovery" && type !== "recovery") return false;
    return true;
  } catch { return false; }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)); }
function renderHtml(subject: string, templateText: string, button: string, actionUrl: string) {
  const paragraphs = templateText.split(/\n\n+/).map((part) => `<p style="margin:0 0 16px;line-height:1.55;color:#d8dee9">${escapeHtml(part).replace(/\n/g, "<br>").replace(escapeHtml(actionUrl), "")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#0b0e11;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #27313c;border-radius:14px;background:#12171d;padding:28px"><div style="font-weight:800;color:#f0b90b;font-size:18px;margin-bottom:18px">CRYPTO LAB</div><h1 style="font-size:22px;color:#fff;margin:0 0 18px">${escapeHtml(subject)}</h1>${paragraphs}<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#f0b90b;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p><p style="font-size:12px;color:#8b98a5;word-break:break-all">${escapeHtml(actionUrl)}</p></div></div></body></html>`;
}
async function sendViaResend(apiKey: string, from: string, replyTo: string, payload: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) {
  const body: Record<string, unknown> = { from, to: [payload.to], subject: payload.subject, text: payload.text, html: payload.html };
  if (replyTo) body.reply_to = replyTo;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "crypto-lab-v79-mail-dispatch/5", "Idempotency-Key": payload.idempotencyKey },
    body: JSON.stringify(body), redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.id) {
    console.error("crypto-lab-mail-dispatch resend", response.status, clean(result?.message || result?.name || "provider_error", 180));
    return { ok: false, status: response.status };
  }
  return { ok: true, id: String(result.id) };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!serviceRoleKey || !supabaseUrl) return json({ ok: false, error: "Server configuration unavailable" }, 503);
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apiKey = request.headers.get("apikey")?.trim() ?? "";
  if (!timingSafeEqual(token, serviceRoleKey) || !timingSafeEqual(apiKey, serviceRoleKey)) return json({ ok: false, error: "Forbidden" }, 403);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ ok: false, error: "Request is too large" }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ ok: false, error: "Request is too large" }, 413);

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed;
  } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const to = clean(body.to, 254).toLowerCase();
  const template = clean(body.template, 40);
  const locale = clean(body.locale, 2);
  const actionUrl = String(body.action_url ?? "").trim().slice(0, 4096);
  const idempotencyKey = clean(body.idempotency_key, 256);
  if (!validEmail(to) || !ALLOWED_TEMPLATES.has(template) || !ALLOWED_LOCALES.has(locale) || !safeActionUrl(actionUrl, template) || !/^[A-Za-z0-9._:-]{8,256}$/.test(idempotencyKey)) return json({ ok: false, error: "Invalid mail request" }, 400);

  const selected = TEMPLATES[template]?.[locale];
  if (!selected) return json({ ok: false, error: "Template unavailable" }, 400);
  const text = selected.text.replace("{{action_url}}", actionUrl);
  const html = renderHtml(selected.subject, selected.text, selected.button, actionUrl);

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = Deno.env.get("CRYPTO_MAIL_FROM")?.trim() ?? "";
  const replyTo = Deno.env.get("CRYPTO_MAIL_REPLY_TO")?.trim() ?? "";
  if (resendKey && mailFrom) {
    const sent = await sendViaResend(resendKey, mailFrom, replyTo, { to, subject: selected.subject, text, html, idempotencyKey });
    if (!sent.ok) return json({ ok: false, error: "Mail provider unavailable", code: "RESEND_SEND_FAILED" }, 503);
    return json({ ok: true, provider: "resend", id: sent.id }, 200);
  }

  const relayUrl = Deno.env.get("CRYPTO_MAIL_RELAY_URL")?.trim() ?? "";
  const relayPublishableKey = Deno.env.get("CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY")?.trim() ?? "";
  if (!relayUrl || !relayPublishableKey) return json({ ok: false, error: "Mail provider is not configured", code: "MAIL_PROVIDER_DISABLED" }, 503);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: relaySecret, error: secretError } = await admin.rpc("get_service_secret", { p_name: "crypto_lab_mail_relay" });
  if (secretError || typeof relaySecret !== "string" || relaySecret.length < 24) return json({ ok: false, error: "Mail relay secret unavailable" }, 503);
  try {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${relayPublishableKey}`, apikey: relayPublishableKey, "Content-Type": "application/json", "x-crypto-lab-mail-key": relaySecret },
      body: JSON.stringify({ to, template, locale, action_url: actionUrl, idempotency_key: idempotencyKey }), redirect: "error",
    });
    const payload = await response.text();
    return new Response(payload, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("crypto-lab-mail-dispatch relay", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: "Mail relay unavailable" }, 503);
  }
});
