import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERSION = "7930-mainnet-health1";
const ALLOWED_ORIGIN = "https://1specnazov1.github.io";
const SOLANA_MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

type Json = Record<string, unknown>;

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function reply(origin: string, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...cors(origin),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function cleanUrl(value: string | undefined): string {
  return (value || "").trim().replace(/\/$/, "");
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 10_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return JSON.parse(text || "{}");
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (payload?.error) throw new Error(`RPC_${payload.error.code ?? "ERR"}`);
  return payload?.result;
}

async function checkEthereum(): Promise<Json> {
  const endpoint = cleanUrl(Deno.env.get("ETHEREUM_MAINNET_RPC_URL"));
  if (!endpoint) return { network: "ETHEREUM", configured: false, ok: false, error: "ENDPOINT_UNCONFIGURED" };
  const started = performance.now();
  try {
    const chainHex = String(await rpc(endpoint, "eth_chainId"));
    const head = String(await rpc(endpoint, "eth_blockNumber"));
    const chainId = BigInt(chainHex).toString();
    return {
      network: "ETHEREUM",
      configured: true,
      ok: chainId === "1",
      chain_reference_observed: chainId,
      latest_block_reference: head,
      latency_ms: Math.round(performance.now() - started),
      error: chainId === "1" ? null : "CHAIN_REFERENCE_MISMATCH",
    };
  } catch (e) {
    return { network: "ETHEREUM", configured: true, ok: false, latency_ms: Math.round(performance.now() - started), error: String(e instanceof Error ? e.message : e).slice(0, 120) };
  }
}

async function checkSolana(): Promise<Json> {
  const endpoint = cleanUrl(Deno.env.get("SOLANA_MAINNET_RPC_URL"));
  if (!endpoint) return { network: "SOLANA", configured: false, ok: false, error: "ENDPOINT_UNCONFIGURED" };
  const started = performance.now();
  try {
    const health = String(await rpc(endpoint, "getHealth"));
    const genesis = String(await rpc(endpoint, "getGenesisHash"));
    const slot = String(await rpc(endpoint, "getSlot", [{ commitment: "finalized" }]));
    const ok = health === "ok" && genesis === SOLANA_MAINNET_GENESIS;
    return {
      network: "SOLANA",
      configured: true,
      ok,
      health,
      chain_reference_observed: genesis,
      latest_block_reference: slot,
      latency_ms: Math.round(performance.now() - started),
      error: ok ? null : "CHAIN_REFERENCE_OR_HEALTH_MISMATCH",
    };
  } catch (e) {
    return { network: "SOLANA", configured: true, ok: false, latency_ms: Math.round(performance.now() - started), error: String(e instanceof Error ? e.message : e).slice(0, 120) };
  }
}

async function checkTron(): Promise<Json> {
  const endpoint = cleanUrl(Deno.env.get("TRON_MAINNET_RPC_URL"));
  const apiKey = (Deno.env.get("TRONGRID_API_KEY") || "").trim();
  if (!endpoint) return { network: "TRON", configured: false, api_key_configured: Boolean(apiKey), ok: false, error: "ENDPOINT_UNCONFIGURED" };
  const started = performance.now();
  try {
    if (/nile|shasta/i.test(endpoint)) {
      return { network: "TRON", configured: true, api_key_configured: Boolean(apiKey), ok: false, error: "TESTNET_ENDPOINT_REJECTED" };
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    const data = await fetchJson(`${endpoint}/walletsolidity/getnowblock`, {
      method: "POST",
      headers,
      body: JSON.stringify({ visible: true }),
    });
    const block = String(data?.block_header?.raw_data?.number ?? "");
    const ok = /^\d+$/.test(block) && Number(block) > 0;
    return {
      network: "TRON",
      configured: true,
      api_key_configured: Boolean(apiKey),
      ok,
      chain_reference_observed: ok ? "mainnet" : "unknown",
      latest_block_reference: block || null,
      latency_ms: Math.round(performance.now() - started),
      error: ok ? null : "INVALID_TRON_HEAD",
    };
  } catch (e) {
    return { network: "TRON", configured: true, api_key_configured: Boolean(apiKey), ok: false, latency_ms: Math.round(performance.now() - started), error: String(e instanceof Error ? e.message : e).slice(0, 120) };
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return origin === ALLOWED_ORIGIN ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
  }
  if (origin !== ALLOWED_ORIGIN) return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
  if (request.method !== "GET" && request.method !== "POST") return reply(origin, { ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !anonKey || !token) return reply(origin, { ok: false, error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin, error: adminError } = await userClient.rpc("crypto_is_admin");
  if (adminError || !isAdmin) return reply(origin, { ok: false, error: "Admin access required" }, 403);

  const results = await Promise.all([checkEthereum(), checkSolana(), checkTron()]);
  const configured = results.filter((x) => x.configured === true).length;
  const healthy = results.filter((x) => x.ok === true).length;
  return reply(origin, {
    ok: healthy === 3,
    verifier_version: VERSION,
    mode: "mainnet_read_only_health",
    configured_networks: configured,
    healthy_networks: healthy,
    results,
    production_write_touched: false,
    payment_activation_changed: false,
    receiving_address_activation_changed: false,
  });
});
