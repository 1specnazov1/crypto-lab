import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERSION = "7930-mainnet-health2";
const ALLOWED_ORIGIN = "https://1specnazov1.github.io";
const SOLANA_MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

type Json = Record<string, any>;
type Candidate = { label: "primary" | "fallback"; endpoint: string };

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
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

function candidates(primaryName: string, fallbackName: string): Candidate[] {
  const result: Candidate[] = [];
  const primary = cleanUrl(Deno.env.get(primaryName));
  const fallback = cleanUrl(Deno.env.get(fallbackName));
  if (primary) result.push({ label: "primary", endpoint: primary });
  if (fallback && fallback !== primary) result.push({ label: "fallback", endpoint: fallback });
  return result;
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

function safeError(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, " ").slice(0, 120);
}

async function tryCandidates(
  network: string,
  list: Candidate[],
  check: (endpoint: string) => Promise<Json>,
): Promise<Json> {
  if (!list.length) {
    return {
      network,
      configured: false,
      configured_candidates: 0,
      ok: false,
      selected_endpoint: null,
      attempts: [],
      error: "ENDPOINT_UNCONFIGURED",
    };
  }

  const attempts: Json[] = [];
  for (const candidate of list) {
    const started = performance.now();
    try {
      const result = await check(candidate.endpoint);
      const attempt = {
        endpoint: candidate.label,
        ok: Boolean(result.ok),
        latency_ms: result.latency_ms ?? Math.round(performance.now() - started),
        error: result.error ?? null,
      };
      attempts.push(attempt);
      if (result.ok) {
        return {
          network,
          configured: true,
          configured_candidates: list.length,
          ok: true,
          selected_endpoint: candidate.label,
          failover_used: candidate.label === "fallback",
          attempts,
          ...result,
        };
      }
    } catch (error) {
      attempts.push({
        endpoint: candidate.label,
        ok: false,
        latency_ms: Math.round(performance.now() - started),
        error: safeError(error),
      });
    }
  }

  return {
    network,
    configured: true,
    configured_candidates: list.length,
    ok: false,
    selected_endpoint: null,
    failover_used: false,
    attempts,
    error: attempts.at(-1)?.error || "ALL_ENDPOINTS_UNHEALTHY",
  };
}

async function checkEthereum(): Promise<Json> {
  return tryCandidates(
    "ETHEREUM",
    candidates("ETHEREUM_MAINNET_RPC_URL", "ETHEREUM_MAINNET_RPC_FALLBACK_URL"),
    async (endpoint) => {
      const started = performance.now();
      const chainHex = String(await rpc(endpoint, "eth_chainId"));
      const head = String(await rpc(endpoint, "eth_blockNumber"));
      const chainId = BigInt(chainHex).toString();
      const ok = chainId === "1";
      return {
        ok,
        chain_reference_observed: chainId,
        latest_block_reference: head,
        finality_reference: null,
        latency_ms: Math.round(performance.now() - started),
        error: ok ? null : "CHAIN_REFERENCE_MISMATCH",
      };
    },
  );
}

async function checkSolana(): Promise<Json> {
  return tryCandidates(
    "SOLANA",
    candidates("SOLANA_MAINNET_RPC_URL", "SOLANA_MAINNET_RPC_FALLBACK_URL"),
    async (endpoint) => {
      const started = performance.now();
      const health = String(await rpc(endpoint, "getHealth"));
      const genesis = String(await rpc(endpoint, "getGenesisHash"));
      const slot = String(await rpc(endpoint, "getSlot", [{ commitment: "finalized" }]));
      const ok = health === "ok" && genesis === SOLANA_MAINNET_GENESIS;
      return {
        ok,
        health,
        chain_reference_observed: genesis,
        latest_block_reference: slot,
        finality_reference: genesis,
        latency_ms: Math.round(performance.now() - started),
        error: ok ? null : "CHAIN_REFERENCE_OR_HEALTH_MISMATCH",
      };
    },
  );
}

async function checkTron(): Promise<Json> {
  const apiKey = (Deno.env.get("TRONGRID_API_KEY") || "").trim();
  const result = await tryCandidates(
    "TRON",
    candidates("TRON_MAINNET_RPC_URL", "TRON_MAINNET_RPC_FALLBACK_URL"),
    async (endpoint) => {
      if (/nile|shasta/i.test(endpoint)) throw new Error("TESTNET_ENDPOINT_REJECTED");
      const started = performance.now();
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
        ok,
        chain_reference_observed: ok ? "mainnet" : "unknown",
        latest_block_reference: block || null,
        finality_reference: String(data?.blockID || "") || null,
        latency_ms: Math.round(performance.now() - started),
        error: ok ? null : "INVALID_TRON_HEAD",
      };
    },
  );
  return { ...result, api_key_configured: Boolean(apiKey) };
}

function healthPayload(result: Json): Json {
  return {
    ok: Boolean(result.ok),
    latency_ms: Number.isInteger(result.latency_ms) ? result.latency_ms : null,
    chain_reference_observed: result.chain_reference_observed ?? null,
    latest_block_reference: result.latest_block_reference ?? null,
    finality_reference: result.finality_reference ?? null,
    error_code: result.ok ? null : String(result.error || "HEALTH_FAILED").slice(0, 80),
    checked_at: new Date().toISOString(),
    evidence: {
      verifier_version: VERSION,
      mode: "mainnet_read_only_health",
      selected_endpoint: result.selected_endpoint ?? null,
      failover_used: Boolean(result.failover_used),
      configured_candidates: result.configured_candidates ?? 0,
      attempts: result.attempts ?? [],
      api_key_configured: result.network === "TRON" ? Boolean(result.api_key_configured) : undefined,
      write_rpc_forbidden: true,
    },
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return origin === ALLOWED_ORIGIN
      ? new Response(null, { status: 204, headers: cors(origin) })
      : new Response(null, { status: 403 });
  }
  if (origin !== ALLOWED_ORIGIN) return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
  if (request.method !== "GET" && request.method !== "POST") return reply(origin, { ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !anonKey || !serviceKey || !token) return reply(origin, { ok: false, error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin, error: adminError } = await userClient.rpc("crypto_is_admin");
  if (adminError || !isAdmin) return reply(origin, { ok: false, error: "Admin access required" }, 403);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: profileError } = await service
    .from("crypto_onchain_verifier_profiles")
    .select("network_code,enabled,read_only,status")
    .eq("environment", "mainnet");
  if (profileError) return reply(origin, { ok: false, error: "Profile state unavailable" }, 503);

  const enabledProfiles = (profiles || []).filter((profile: any) => profile.enabled === true).length;
  const nonReadOnlyProfiles = (profiles || []).filter((profile: any) => profile.read_only !== true).length;
  if (nonReadOnlyProfiles > 0) {
    return reply(origin, { ok: false, error: "NON_READ_ONLY_MAINNET_PROFILE_REJECTED" }, 409);
  }

  const results = await Promise.all([checkEthereum(), checkSolana(), checkTron()]);
  const healthLog: Json[] = [];
  for (const result of results) {
    const { data, error } = await service.rpc("service_record_crypto_onchain_verifier_health", {
      p_network: result.network,
      p_environment: "mainnet",
      p_result: healthPayload(result),
    });
    healthLog.push({ network: result.network, recorded: !error, run: data ?? null });
  }

  const configured = results.filter((x) => x.configured === true).length;
  const healthy = results.filter((x) => x.ok === true).length;
  return reply(origin, {
    ok: healthy === 3,
    verifier_version: VERSION,
    mode: "mainnet_read_only_health",
    configured_networks: configured,
    healthy_networks: healthy,
    mainnet_profiles_enabled: enabledProfiles,
    activation_boundary_ok: enabledProfiles === 0,
    health_log: healthLog,
    results,
    production_write_touched: false,
    payment_activation_changed: false,
    receiving_address_activation_changed: false,
  });
});
