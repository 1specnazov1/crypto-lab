import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const VERIFIER_VERSION = "7930-rpc1";

const ALLOWED_ORIGIN = "https://1specnazov1.github.io";
const MAX_BODY_BYTES = 24_000;
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type JsonRecord = Record<string, any>;

type VerifierProfile = {
  network_code: "ETHEREUM" | "TRON" | "SOLANA";
  environment: "sandbox" | "mainnet";
  provider_code: string;
  chain_reference_expected: string;
  public_endpoint: string | null;
  endpoint_secret_name: string | null;
  api_key_secret_name: string | null;
};

type SandboxCase = {
  id: string;
  network_code: "ETHEREUM" | "TRON" | "SOLANA";
  asset_code: "USDT" | "USDC";
  token_identifier: string | null;
  recipient_address: string;
  expected_amount_base_units: string | number;
};

type ParsedTransfer = {
  sender_address: string | null;
  recipient_address: string;
  token_identifier: string;
  amount_base_units: string;
  block_reference: string | null;
  execution_success: boolean;
};

type NormalizedObservation = ParsedTransfer & {
  network_code: "ETHEREUM" | "TRON" | "SOLANA";
  tx_hash: string;
  asset_code: "USDT" | "USDC";
  finality_status: "confirmed" | "finalized" | "solidified";
  verifier_source: string;
  observed_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: unknown, maxLength = 180): string {
  return String(value ?? "")
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function lowerHex(value: string): string {
  return value.toLowerCase().replace(/^0x/, "");
}

function cors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string,
): Response {
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

function safeError(error: unknown): string {
  return clean(error instanceof Error ? error.message : error) ||
    "VERIFIER_ERROR";
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
): Promise<JsonRecord> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return JSON.parse(text || "{}") as JsonRecord;
  } finally {
    clearTimeout(timer);
  }
}

async function jsonRpc(
  url: string,
  method: string,
  params: unknown[],
  additionalHeaders: Record<string, string> = {},
): Promise<any> {
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...additionalHeaders },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (payload.error) {
    throw new Error(
      `RPC_${clean(payload.error.code, 20)}_${clean(payload.error.message)}`,
    );
  }
  return payload.result;
}

function resolveEndpoint(profile: VerifierProfile): string {
  if (profile.public_endpoint) return profile.public_endpoint.replace(/\/$/, "");
  if (profile.endpoint_secret_name) {
    return (Deno.env.get(profile.endpoint_secret_name) || "").replace(/\/$/, "");
  }
  return "";
}

function providerHeaders(profile: VerifierProfile): Record<string, string> {
  const result: Record<string, string> = {};
  if (profile.api_key_secret_name) {
    const key = Deno.env.get(profile.api_key_secret_name) || "";
    if (key) result["TRON-PRO-API-KEY"] = key;
  }
  return result;
}

function assertTransactionHash(network: string, txHash: string): void {
  const valid = network === "ETHEREUM"
    ? /^0x[0-9a-fA-F]{64}$/.test(txHash)
    : network === "TRON"
    ? /^[0-9a-fA-F]{64}$/.test(txHash)
    : /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash);
  if (!valid) throw new Error("INVALID_TX_HASH");
}

export function decodeBase58(value: string): Uint8Array {
  let numeric = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("INVALID_BASE58");
    numeric = numeric * 58n + BigInt(index);
  }

  let hex = numeric.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let output = hex
    ? Uint8Array.from(hex.match(/.{2}/g)!.map((item) => parseInt(item, 16)))
    : new Uint8Array();

  let leadingZeros = 0;
  while (leadingZeros < value.length && value[leadingZeros] === "1") {
    leadingZeros += 1;
  }
  if (leadingZeros) {
    const merged = new Uint8Array(leadingZeros + output.length);
    merged.set(output, leadingZeros);
    output = merged;
  }
  return output;
}

export async function tronAddressHex(address: string): Promise<string> {
  const raw = decodeBase58(address);
  if (raw.length !== 25 || raw[0] !== 0x41) {
    throw new Error("INVALID_TRON_ADDRESS");
  }

  const body = raw.slice(0, 21);
  const checksum = raw.slice(21);
  const firstHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", body),
  );
  const secondHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", firstHash),
  );
  if (!checksum.every((value, index) => value === secondHash[index])) {
    throw new Error("INVALID_TRON_CHECKSUM");
  }
  return [...body].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function parseEthereumTransfer(
  receipt: JsonRecord | null,
  transaction: JsonRecord | null,
  tokenIdentifier: string,
  recipientAddress: string,
): ParsedTransfer {
  if (!receipt) throw new Error("TX_NOT_FOUND");
  const tokenHex = lowerHex(tokenIdentifier);
  const recipientTopic = lowerHex(recipientAddress).padStart(64, "0");
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transferLog = logs.find((item: JsonRecord) =>
    lowerHex(String(item.address || "")) === tokenHex &&
    String(item.topics?.[0] || "").toLowerCase() === TRANSFER_TOPIC &&
    lowerHex(String(item.topics?.[2] || "")) === recipientTopic
  );
  if (!transferLog) throw new Error("TRANSFER_LOG_NOT_FOUND");

  return {
    sender_address: transaction?.from ? String(transaction.from) : null,
    recipient_address: recipientAddress,
    token_identifier: tokenIdentifier,
    amount_base_units: BigInt(String(transferLog.data || "0x0")).toString(),
    block_reference: receipt.blockNumber ? String(receipt.blockNumber) : null,
    execution_success: String(receipt.status || "").toLowerCase() === "0x1",
  };
}

export async function parseTronTransfer(
  info: JsonRecord | null,
  transaction: JsonRecord | null,
  tokenIdentifier: string,
  recipientAddress: string,
): Promise<ParsedTransfer> {
  if (!info?.id) throw new Error("TX_NOT_FOUND");
  const tokenHex = (await tronAddressHex(tokenIdentifier)).slice(2).toLowerCase();
  const recipientTopic = (await tronAddressHex(recipientAddress))
    .slice(2)
    .padStart(64, "0")
    .toLowerCase();
  const logs = Array.isArray(info.log) ? info.log : [];
  const transferLog = logs.find((item: JsonRecord) =>
    lowerHex(String(item.address || "")) === tokenHex &&
    `0x${lowerHex(String(item.topics?.[0] || ""))}` === TRANSFER_TOPIC &&
    lowerHex(String(item.topics?.[2] || "")) === recipientTopic
  );
  if (!transferLog) throw new Error("TRANSFER_LOG_NOT_FOUND");

  const owner = transaction?.raw_data?.contract?.[0]?.parameter?.value
    ?.owner_address;
  const result = String(info.receipt?.result || info.result || "").toUpperCase();
  return {
    sender_address: owner ? String(owner) : null,
    recipient_address: recipientAddress,
    token_identifier: tokenIdentifier,
    amount_base_units: BigInt(
      `0x${lowerHex(String(transferLog.data || "0")) || "0"}`,
    ).toString(),
    block_reference: info.blockNumber !== undefined
      ? String(info.blockNumber)
      : null,
    execution_success: result === "SUCCESS",
  };
}

export function parseSolanaTransfer(
  transaction: JsonRecord | null,
  mint: string,
  recipientAddress: string,
): ParsedTransfer {
  if (!transaction) throw new Error("TX_NOT_FOUND");
  const preBalances = Array.isArray(transaction.meta?.preTokenBalances)
    ? transaction.meta.preTokenBalances
    : [];
  const postBalances = Array.isArray(transaction.meta?.postTokenBalances)
    ? transaction.meta.postTokenBalances
    : [];

  let received = 0n;
  for (const post of postBalances as JsonRecord[]) {
    if (String(post.mint) !== mint || String(post.owner) !== recipientAddress) {
      continue;
    }
    const before = (preBalances as JsonRecord[]).find((item) =>
      item.accountIndex === post.accountIndex &&
      String(item.mint) === mint &&
      String(item.owner) === recipientAddress
    );
    received += BigInt(String(post.uiTokenAmount?.amount || "0")) -
      BigInt(String(before?.uiTokenAmount?.amount || "0"));
  }
  if (received <= 0n) throw new Error("TOKEN_DELTA_NOT_FOUND");

  const accountKeys = Array.isArray(transaction.transaction?.message?.accountKeys)
    ? transaction.transaction.message.accountKeys
    : [];
  const firstKey = accountKeys[0];
  const sender = typeof firstKey === "string" ? firstKey : firstKey?.pubkey;
  return {
    sender_address: sender ? String(sender) : null,
    recipient_address: recipientAddress,
    token_identifier: mint,
    amount_base_units: received.toString(),
    block_reference: transaction.slot !== undefined
      ? String(transaction.slot)
      : null,
    execution_success: transaction.meta?.err === null,
  };
}

async function checkHealth(profile: VerifierProfile): Promise<JsonRecord> {
  const started = performance.now();
  const url = resolveEndpoint(profile);
  if (!url) {
    return {
      ok: false,
      latency_ms: 0,
      error_code: "ENDPOINT_UNCONFIGURED",
      checked_at: nowIso(),
      evidence: { provider_code: profile.provider_code, read_only: true },
    };
  }

  try {
    if (profile.network_code === "ETHEREUM") {
      const chainReference = BigInt(
        String(await jsonRpc(url, "eth_chainId", [])),
      ).toString();
      const head = await jsonRpc(url, "eth_blockNumber", []);
      let finalized = "";
      try {
        finalized = String(
          (await jsonRpc(url, "eth_getBlockByNumber", ["finalized", false]))
            ?.number || "",
        );
      } catch {
        // Some providers do not expose the finalized block tag.
      }
      return {
        ok: chainReference === profile.chain_reference_expected,
        latency_ms: Math.round(performance.now() - started),
        chain_reference_observed: chainReference,
        latest_block_reference: String(head),
        finality_reference: finalized,
        error_code: chainReference === profile.chain_reference_expected
          ? null
          : "CHAIN_REFERENCE_MISMATCH",
        checked_at: nowIso(),
        evidence: { provider_code: profile.provider_code, read_only: true },
      };
    }

    if (profile.network_code === "TRON") {
      const data = await fetchJson(`${url}/wallet/getnowblock`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...providerHeaders(profile),
        },
        body: JSON.stringify({ visible: true }),
      });
      const block = String(data.block_header?.raw_data?.number ?? "");
      if (!block) throw new Error("INVALID_TRON_HEAD");
      return {
        ok: true,
        latency_ms: Math.round(performance.now() - started),
        chain_reference_observed: "nile",
        latest_block_reference: block,
        finality_reference: String(data.blockID || ""),
        error_code: null,
        checked_at: nowIso(),
        evidence: { provider_code: profile.provider_code, read_only: true },
      };
    }

    const health = await jsonRpc(url, "getHealth", []);
    const genesisHash = await jsonRpc(url, "getGenesisHash", []);
    const slot = await jsonRpc(url, "getSlot", [{ commitment: "finalized" }]);
    return {
      ok: health === "ok",
      latency_ms: Math.round(performance.now() - started),
      chain_reference_observed: "devnet",
      latest_block_reference: String(slot),
      finality_reference: String(genesisHash),
      error_code: health === "ok" ? null : "SOLANA_UNHEALTHY",
      checked_at: nowIso(),
      evidence: { provider_code: profile.provider_code, read_only: true },
    };
  } catch (error) {
    return {
      ok: false,
      latency_ms: Math.round(performance.now() - started),
      error_code: safeError(error),
      checked_at: nowIso(),
      evidence: { provider_code: profile.provider_code, read_only: true },
    };
  }
}

async function verifyCase(
  profile: VerifierProfile,
  sandboxCase: SandboxCase,
  txHash: string,
): Promise<NormalizedObservation> {
  assertTransactionHash(sandboxCase.network_code, txHash);
  if (!sandboxCase.token_identifier) {
    throw new Error("TOKEN_IDENTIFIER_UNCONFIGURED");
  }
  const url = resolveEndpoint(profile);
  if (!url) throw new Error("ENDPOINT_UNCONFIGURED");

  if (sandboxCase.network_code === "ETHEREUM") {
    const receipt = await jsonRpc(url, "eth_getTransactionReceipt", [txHash]);
    const transaction = await jsonRpc(url, "eth_getTransactionByHash", [txHash]);
    const parsed = parseEthereumTransfer(
      receipt,
      transaction,
      sandboxCase.token_identifier,
      sandboxCase.recipient_address,
    );
    let finality: "confirmed" | "finalized" = "confirmed";
    try {
      const finalized = await jsonRpc(
        url,
        "eth_getBlockByNumber",
        ["finalized", false],
      );
      if (
        finalized?.number && receipt?.blockNumber &&
        BigInt(String(receipt.blockNumber)) <= BigInt(String(finalized.number))
      ) {
        finality = "finalized";
      }
    } catch {
      // Keep confirmed when finalized block is unavailable.
    }
    return {
      network_code: sandboxCase.network_code,
      tx_hash: txHash,
      asset_code: sandboxCase.asset_code,
      ...parsed,
      finality_status: finality,
      verifier_source: "ethereum_json_rpc_sandbox",
      observed_at: nowIso(),
    };
  }

  if (sandboxCase.network_code === "TRON") {
    const requestHeaders = {
      "content-type": "application/json",
      ...providerHeaders(profile),
    };
    const info = await fetchJson(
      `${url}/walletsolidity/gettransactioninfobyid`,
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ value: txHash }),
      },
    );
    const transaction = await fetchJson(`${url}/wallet/gettransactionbyid`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ value: txHash, visible: true }),
    });
    const parsed = await parseTronTransfer(
      info,
      transaction,
      sandboxCase.token_identifier,
      sandboxCase.recipient_address,
    );
    return {
      network_code: sandboxCase.network_code,
      tx_hash: txHash,
      asset_code: sandboxCase.asset_code,
      ...parsed,
      finality_status: "solidified",
      verifier_source: "trongrid_nile_sandbox",
      observed_at: nowIso(),
    };
  }

  const transaction = await jsonRpc(url, "getTransaction", [
    txHash,
    {
      encoding: "jsonParsed",
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    },
  ]);
  const parsed = parseSolanaTransfer(
    transaction,
    sandboxCase.token_identifier,
    sandboxCase.recipient_address,
  );
  return {
    network_code: sandboxCase.network_code,
    tx_hash: txHash,
    asset_code: sandboxCase.asset_code,
    ...parsed,
    finality_status: "finalized",
    verifier_source: "solana_json_rpc_sandbox",
    observed_at: nowIso(),
  };
}

export async function fixtureSelfTest(): Promise<JsonRecord> {
  const ethereumRecipient =
    "0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9";
  const ethereumToken = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const ethereum = parseEthereumTransfer(
    {
      status: "0x1",
      blockNumber: "0x10",
      logs: [{
        address: ethereumToken,
        topics: [
          TRANSFER_TOPIC,
          `0x${"0".repeat(64)}`,
          `0x${lowerHex(ethereumRecipient).padStart(64, "0")}`,
        ],
        data: "0x2710",
      }],
    },
    { from: "0x1111111111111111111111111111111111111111" },
    ethereumToken,
    ethereumRecipient,
  );

  const solana = parseSolanaTransfer(
    {
      slot: 10,
      meta: {
        err: null,
        preTokenBalances: [],
        postTokenBalances: [{
          accountIndex: 1,
          mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
          owner: "EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F",
          uiTokenAmount: { amount: "10000" },
        }],
      },
      transaction: {
        message: {
          accountKeys: [{
            pubkey: "Sender111111111111111111111111111111111",
          }],
        },
      },
    },
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F",
  );

  return {
    ethereum: ethereum.amount_base_units === "10000" &&
      ethereum.execution_success,
    solana: solana.amount_base_units === "10000" && solana.execution_success,
    tron_base58: (await tronAddressHex(
      "TKvGfxac4bpFVjdif9vVGoUENBHkidR1WA",
    )).startsWith("41"),
    version: VERIFIER_VERSION,
  };
}

if (import.meta.main) {
  Deno.serve(async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") || "";

    if (request.method === "OPTIONS") {
      return origin === ALLOWED_ORIGIN
        ? new Response(null, { status: 204, headers: cors(origin) })
        : new Response(null, { status: 403 });
    }
    if (origin !== ALLOWED_ORIGIN) {
      return Response.json({ ok: false, error: "Origin not allowed" }, {
        status: 403,
      });
    }
    if (!(["GET", "POST"] as string[]).includes(request.method)) {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const token = (request.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!supabaseUrl || !serviceKey || !anonKey || !token) {
      return jsonResponse(
        { ok: false, error: "Authentication required" },
        401,
        origin,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(
        { ok: false, error: "Authentication required" },
        401,
        origin,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: isAdmin, error: adminError } = await userClient.rpc(
      "crypto_is_admin",
    );
    if (adminError || !isAdmin) {
      return jsonResponse(
        { ok: false, error: "Admin access required" },
        403,
        origin,
      );
    }

    try {
      if (request.method === "GET") {
        const { data, error } = await userClient.rpc(
          "get_crypto_admin_onchain_sandbox_readiness",
        );
        if (error) throw error;
        return jsonResponse(
          { ok: true, readiness: data, verifier_version: VERIFIER_VERSION },
          200,
          origin,
        );
      }

      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, error: "Request too large" }, 413, origin);
      }
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, error: "Request too large" }, 413, origin);
      }
      const body = JSON.parse(rawBody || "{}") as JsonRecord;
      const action = clean(body.action, 50);

      if (action === "health") {
        const { data: profiles, error } = await admin
          .from("crypto_onchain_verifier_profiles")
          .select("*")
          .eq("environment", "sandbox")
          .order("network_code");
        if (error) throw error;

        const results: JsonRecord[] = [];
        for (const profile of (profiles || []) as VerifierProfile[]) {
          const result = await checkHealth(profile);
          const { error: saveError } = await admin.rpc(
            "service_record_crypto_onchain_verifier_health",
            {
              p_network: profile.network_code,
              p_environment: profile.environment,
              p_result: result,
            },
          );
          if (saveError) throw saveError;
          results.push({ network_code: profile.network_code, ...result });
        }
        return jsonResponse(
          {
            ok: true,
            results,
            verifier_version: VERIFIER_VERSION,
            production_touched: false,
          },
          200,
          origin,
        );
      }

      if (action === "fixture_self_test") {
        const startedAt = nowIso();
        const fixtures = await fixtureSelfTest();
        const passed = Boolean(
          fixtures.ethereum && fixtures.solana && fixtures.tron_base58,
        );
        const { data: cases, error } = await admin
          .from("crypto_onchain_sandbox_cases")
          .select("id,network_code")
          .eq("environment", "sandbox");
        if (error) throw error;

        for (const sandboxCase of cases || []) {
          const { error: saveError } = await admin.rpc(
            "service_record_crypto_onchain_sandbox_run",
            {
              p_case_id: sandboxCase.id,
              p_result: {
                status: passed ? "fixture_pass" : "fixture_fail",
                verifier_version: VERIFIER_VERSION,
                normalized_observation: {
                  fixture_network: sandboxCase.network_code,
                  fixtures,
                },
                started_at: startedAt,
                completed_at: nowIso(),
                error_code: passed ? null : "FIXTURE_FAILED",
              },
            },
          );
          if (saveError) throw saveError;
        }
        return jsonResponse(
          {
            ok: passed,
            fixtures,
            verifier_version: VERIFIER_VERSION,
            production_touched: false,
          },
          passed ? 200 : 500,
          origin,
        );
      }

      if (action === "verify_sandbox_transaction") {
        const caseId = clean(body.case_id, 60);
        const txHash = clean(body.tx_hash, 100);
        if (!/^[0-9a-f-]{36}$/i.test(caseId)) {
          return jsonResponse({ ok: false, error: "Invalid case" }, 400, origin);
        }

        const { data: sandboxCase, error: caseError } = await admin
          .from("crypto_onchain_sandbox_cases")
          .select("*")
          .eq("id", caseId)
          .single();
        if (caseError || !sandboxCase) {
          return jsonResponse(
            { ok: false, error: "Sandbox case not found" },
            404,
            origin,
          );
        }

        const { data: profile, error: profileError } = await admin
          .from("crypto_onchain_verifier_profiles")
          .select("*")
          .eq("network_code", sandboxCase.network_code)
          .eq("environment", "sandbox")
          .single();
        if (profileError || !profile) {
          throw profileError ?? new Error("PROFILE_NOT_FOUND");
        }

        const startedAt = nowIso();
        try {
          const observation = await verifyCase(
            profile as VerifierProfile,
            sandboxCase as SandboxCase,
            txHash,
          );
          const passed = observation.execution_success &&
            observation.recipient_address === sandboxCase.recipient_address &&
            observation.token_identifier === sandboxCase.token_identifier &&
            observation.amount_base_units ===
              String(sandboxCase.expected_amount_base_units) &&
            (["finalized", "solidified"] as string[]).includes(
              observation.finality_status,
            );

          const { data: run, error: runError } = await admin.rpc(
            "service_record_crypto_onchain_sandbox_run",
            {
              p_case_id: sandboxCase.id,
              p_result: {
                status: passed ? "passed" : "failed",
                tx_hash: txHash,
                verifier_version: VERIFIER_VERSION,
                normalized_observation: observation,
                started_at: startedAt,
                completed_at: nowIso(),
                error_code: passed ? null : "OBSERVATION_MISMATCH",
              },
            },
          );
          if (runError) throw runError;
          return jsonResponse(
            {
              ok: passed,
              observation,
              run,
              production_touched: false,
              entitlement_changed: false,
            },
            passed ? 200 : 409,
            origin,
          );
        } catch (error) {
          const code = safeError(error);
          await admin.rpc("service_record_crypto_onchain_sandbox_run", {
            p_case_id: sandboxCase.id,
            p_result: {
              status: "failed",
              tx_hash: txHash,
              verifier_version: VERIFIER_VERSION,
              normalized_observation: {},
              started_at: startedAt,
              completed_at: nowIso(),
              error_code: code,
            },
          });
          return jsonResponse(
            {
              ok: false,
              error: code,
              production_touched: false,
              entitlement_changed: false,
            },
            400,
            origin,
          );
        }
      }

      return jsonResponse({ ok: false, error: "Unsupported action" }, 400, origin);
    } catch (error) {
      console.error("crypto-lab-v79-chain-verifier", error);
      return jsonResponse(
        { ok: false, error: "Chain verifier temporarily unavailable" },
        500,
        origin,
      );
    }
  });
}
