import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
const MONITOR_SECRET = Deno.env.get("MONITOR_SECRET") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SIGNAL_PAGE_SIZE = 250;
const MAX_SIGNAL_PAGES = 40;
const BINANCE_SYMBOL_CHUNK = 40;
const RPC_UPDATE_CHUNK = 100;
const NOTIFICATION_CLAIM_LIMIT = 20;
const SELECT_FIELDS = "id,symbol,timeframe,direction,status,entry_low,entry_high,stop,tp1,tp2,tp3";

type Signal = {
  id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  status: string;
  entry_low: number;
  entry_high: number;
  stop: number;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
};

type PriceUpdate = { id: string; price: number };

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clean(value: unknown, max = 1000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function formatPrice(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
        maximumFractionDigits: number < 1 ? 8 : number < 10 ? 5 : 2,
      })
    : "—";
}

function messageFor(payload: Record<string, unknown>) {
  const symbol = clean(payload.symbol, 20);
  const timeframe = clean(payload.timeframe, 10);
  const direction = clean(payload.direction, 10);
  const event = clean(payload.event_type, 10);
  const price = formatPrice(payload.price);
  const head = event === "STOP" ? "🔴" : event === "TP3" ? "🏆" : event === "ENTRY" ? "🟡" : "✅";
  const base = `${head} CRYPTO LAB 24/7\n\n${symbol}/USDT · ${timeframe}\nНаправление: ${direction}\nЦена Binance: ${price}`;
  if (event === "ENTRY") {
    return `${base}\nСобытие: ЦЕНА ДОСТИГЛА ВХОДА\nЗона входа: ${formatPrice(payload.entry_low)} – ${formatPrice(payload.entry_high)}`;
  }
  if (event === "TP1") return `${base}\nСобытие: TP1 ДОСТИГНУТ\nTP1: ${formatPrice(payload.tp1)}`;
  if (event === "TP2") return `${base}\nСобытие: TP2 ДОСТИГНУТ\nTP2: ${formatPrice(payload.tp2)}`;
  if (event === "TP3") return `${base}\nСобытие: TP3 ДОСТИГНУТ\nTP3: ${formatPrice(payload.tp3)}`;
  const reached = [payload.tp1_previously_reached ? "TP1" : "", payload.tp2_previously_reached ? "TP2" : ""]
    .filter(Boolean)
    .join(", ");
  return `${base}\nСобытие: STOP LOSS\nStop Loss: ${formatPrice(payload.stop)}\n${reached ? `До Stop были достигнуты: ${reached}` : "TP не достигнуты"}`;
}

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("Telegram configuration unavailable");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
      throw new Error(`Telegram ${response.status}: ${clean(body?.description || "send failed", 240)}`);
    }
    return String(body?.result?.message_id ?? "");
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllLiveSignals() {
  const signals: Signal[] = [];
  let expectedCount: number | null = null;
  let pageCount = 0;

  for (let page = 0; page < MAX_SIGNAL_PAGES; page += 1) {
    const from = page * SIGNAL_PAGE_SIZE;
    const to = from + SIGNAL_PAGE_SIZE - 1;
    const { data, error, count } = await admin
      .from("crypto_signal_monitors")
      .select(SELECT_FIELDS, { count: page === 0 ? "exact" : undefined })
      .in("status", ["WAITING", "ACTIVE"])
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (page === 0 && typeof count === "number") expectedCount = count;
    const rows = (data || []) as Signal[];
    signals.push(...rows);
    pageCount += 1;

    if (rows.length < SIGNAL_PAGE_SIZE) {
      if (expectedCount !== null && signals.length !== expectedCount) {
        throw new Error(`Signal pagination mismatch: expected ${expectedCount}, fetched ${signals.length}`);
      }
      return { signals, expectedCount: expectedCount ?? signals.length, pageCount };
    }
  }

  throw new Error(`Live signal set exceeds bounded capacity of ${SIGNAL_PAGE_SIZE * MAX_SIGNAL_PAGES}`);
}

async function fetchBinancePrices(symbols: string[]) {
  const prices: Record<string, number> = {};
  const symbolChunks = chunks(symbols, BINANCE_SYMBOL_CHUNK);

  for (const symbolChunk of symbolChunks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const encoded = encodeURIComponent(JSON.stringify(symbolChunk));
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encoded}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Binance ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid Binance response");
      for (const row of rows) {
        const value = Number(row?.price);
        const symbol = String(row?.symbol || "");
        if (symbol && Number.isFinite(value) && value > 0) prices[symbol] = value;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const missing = symbols.filter((symbol) => !Number.isFinite(prices[symbol]) || prices[symbol] <= 0);
  if (missing.length) {
    throw new Error(`Missing Binance prices for ${missing.slice(0, 10).join(",")}${missing.length > 10 ? ",…" : ""}`);
  }
  return { prices, chunkCount: symbolChunks.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);
  if (!MONITOR_SECRET || req.headers.get("x-monitor-secret") !== MONITOR_SECRET) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Supabase configuration unavailable" }, 503);
  }

  try {
    const source = await fetchAllLiveSignals();
    const activeSignals = source.signals;
    const symbols = [...new Set(activeSignals.map((signal) => `${signal.symbol}USDT`))];
    const priceResult = symbols.length
      ? await fetchBinancePrices(symbols)
      : { prices: {} as Record<string, number>, chunkCount: 0 };

    const updates: PriceUpdate[] = activeSignals.map((signal) => ({
      id: signal.id,
      price: priceResult.prices[`${signal.symbol}USDT`],
    }));

    let checked = 0;
    let missing = 0;
    let transitioned = 0;
    let queued = 0;
    const updateChunks = chunks(updates, RPC_UPDATE_CHUNK);

    for (const updateChunk of updateChunks) {
      const { data, error } = await admin.rpc("service_apply_crypto_signal_monitor_batch", {
        p_updates: updateChunk,
      });
      if (error) throw error;
      checked += Number(data?.checked || 0);
      missing += Number(data?.missing || 0);
      transitioned += Number(data?.transitioned || 0);
      queued += Number(data?.queued || 0);
    }

    const unprocessed = activeSignals.length - checked - missing;
    if (unprocessed !== 0) {
      throw new Error(`Monitor coverage mismatch: fetched ${activeSignals.length}, checked ${checked}, missing ${missing}`);
    }

    const { data: claimed, error: claimError } = await admin.rpc("service_claim_crypto_signal_notifications", {
      p_limit: NOTIFICATION_CLAIM_LIMIT,
    });
    if (claimError) throw claimError;
    const notifications = Array.isArray(claimed) ? claimed : [];
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const notification of notifications) {
      const id = String(notification?.id || "");
      try {
        const telegramMessageId = await sendTelegram(
          messageFor((notification?.payload || {}) as Record<string, unknown>),
        );
        const { data: marked, error: markError } = await admin.rpc(
          "service_mark_crypto_signal_notification_sent",
          { p_id: id, p_telegram_message_id: telegramMessageId || null },
        );
        if (markError || marked !== true) {
          throw markError || new Error("Notification sent but acknowledgement failed");
        }
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = clean(error instanceof Error ? error.message : String(error), 500);
        errors.push(`${id}: ${message}`);
        await admin.rpc("service_mark_crypto_signal_notification_failed", {
          p_id: id,
          p_error: message,
        });
      }
    }

    return json({
      success: true,
      monitor_version: 6,
      source_count: source.expectedCount,
      fetched: activeSignals.length,
      signal_pages: source.pageCount,
      unique_symbols: symbols.length,
      binance_chunks: priceResult.chunkCount,
      rpc_chunks: updateChunks.length,
      checked,
      missing,
      transitioned,
      queued,
      notifications_claimed: notifications.length,
      notifications_sent: sent,
      notification_failures: failed,
      errors,
    });
  } catch (error) {
    console.error("crypto-signal-monitor", error);
    return json(
      { success: false, monitor_version: 6, error: clean(error instanceof Error ? error.message : String(error), 500) },
      500,
    );
  }
});