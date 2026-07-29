import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID")!;
const monitorSecret = Deno.env.get("MONITOR_SECRET")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatPrice = (value: number) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: value < 1 ? 8 : value < 10 ? 5 : 2,
  });

async function sendTelegram(text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram error: ${response.status}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok");
  }

  if (!monitorSecret) {
    return json({ error: "MONITOR_SECRET не настроен" }, 500);
  }

  if (request.headers.get("x-monitor-secret") !== monitorSecret) {
    return json({ error: "Недействительный ключ" }, 401);
  }

  try {
    const { data: signals, error } = await supabase
      .from("crypto_signal_monitors")
      .select("*")
      .in("status", ["WAITING", "ACTIVE"])
      .limit(100);

    if (error) throw error;

    if (!signals?.length) {
      return json({ success: true, checked: 0, notifications: 0 });
    }

    const symbols = [
      ...new Set(signals.map((signal) => `${signal.symbol}USDT`)),
    ];

    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${
        encodeURIComponent(JSON.stringify(symbols))
      }`,
    );

    if (!binanceResponse.ok) {
      throw new Error(`Binance error: ${binanceResponse.status}`);
    }

    const binanceData = await binanceResponse.json();
    const prices = Object.fromEntries(
      binanceData.map((item: { symbol: string; price: string }) => [
        item.symbol,
        Number(item.price),
      ]),
    );

    let notifications = 0;
    const errors: string[] = [];

    for (const signal of signals) {
      try {
        const price = prices[`${signal.symbol}USDT`];
        if (!Number.isFinite(price)) continue;

        const direction = signal.direction;
        const entryLow = toNumber(signal.entry_low);
        const entryHigh = toNumber(signal.entry_high);
        const stop = toNumber(signal.stop);
        const tp1 = toNumber(signal.tp1);
        const tp2 = toNumber(signal.tp2);
        const tp3 = toNumber(signal.tp3);
        const previousPrice = toNumber(signal.last_price);
        const now = new Date().toISOString();

        const updates: Record<string, unknown> = {
          last_price: price,
          last_checked_at: now,
          updated_at: now,
        };

        let message = "";

        if (
          signal.status === "WAITING" &&
          entryLow !== null &&
          entryHigh !== null
        ) {
          const low = Math.min(entryLow, entryHigh);
          const high = Math.max(entryLow, entryHigh);

          const inside = price >= low && price <= high;
          const crossed = previousPrice !== null &&
            Math.min(previousPrice, price) <= high &&
            Math.max(previousPrice, price) >= low;

          if (inside || crossed) {
            updates.status = "ACTIVE";
            updates.entry_notified = true;
            updates.activated_at = now;

            message =
              `🟡 CRYPTO LAB 24/7\n\n` +
              `${signal.symbol}/USDT · ${signal.timeframe}\n` +
              `Событие: ЦЕНА ДОСТИГЛА ВХОДА\n` +
              `Направление: ${direction}\n` +
              `Цена Binance: ${formatPrice(price)}\n` +
              `Зона входа: ${formatPrice(low)} – ${formatPrice(high)}`;
          }
        } else if (signal.status === "ACTIVE") {
          const isLong = direction === "LONG";
          const stopHit = stop !== null &&
            (isLong ? price <= stop : price >= stop);

          const tp3Hit = tp3 !== null &&
            (isLong ? price >= tp3 : price <= tp3);

          const tp2Hit = tp2 !== null &&
            (isLong ? price >= tp2 : price <= tp2);

          const tp1Hit = tp1 !== null &&
            (isLong ? price >= tp1 : price <= tp1);

          if (stopHit && !signal.stop_notified) {
            updates.status = "CLOSED";
            updates.stop_notified = true;
            updates.closed_at = now;
            updates.close_type = "STOP";

            const reached = [
              signal.tp1_notified ? "TP1" : "",
              signal.tp2_notified ? "TP2" : "",
            ].filter(Boolean).join(", ");

            message =
              `🔴 CRYPTO LAB 24/7\n\n` +
              `${signal.symbol}/USDT · ${signal.timeframe}\n` +
              `Событие: STOP LOSS\n` +
              `Направление: ${direction}\n` +
              `Цена Binance: ${formatPrice(price)}\n` +
              `Stop Loss: ${formatPrice(stop!)}\n` +
              `${reached ? `До Stop были достигнуты: ${reached}` : "TP не достигнуты"}`;
          } else if (tp3Hit && !signal.tp3_notified) {
            updates.status = "CLOSED";
            updates.tp1_notified = true;
            updates.tp2_notified = true;
            updates.tp3_notified = true;
            updates.closed_at = now;
            updates.close_type = "TP3";

            message =
              `🏆 CRYPTO LAB 24/7\n\n` +
              `${signal.symbol}/USDT · ${signal.timeframe}\n` +
              `Событие: TP3 ДОСТИГНУТ\n` +
              `Направление: ${direction}\n` +
              `Цена Binance: ${formatPrice(price)}\n` +
              `TP3: ${formatPrice(tp3!)}`;
          } else if (tp2Hit && !signal.tp2_notified) {
            updates.tp1_notified = true;
            updates.tp2_notified = true;

            message =
              `✅ CRYPTO LAB 24/7\n\n` +
              `${signal.symbol}/USDT · ${signal.timeframe}\n` +
              `Событие: TP2 ДОСТИГНУТ\n` +
              `Направление: ${direction}\n` +
              `Цена Binance: ${formatPrice(price)}\n` +
              `TP2: ${formatPrice(tp2!)}`;
          } else if (tp1Hit && !signal.tp1_notified) {
            updates.tp1_notified = true;

            message =
              `✅ CRYPTO LAB 24/7\n\n` +
              `${signal.symbol}/USDT · ${signal.timeframe}\n` +
              `Событие: TP1 ДОСТИГНУТ\n` +
              `Направление: ${direction}\n` +
              `Цена Binance: ${formatPrice(price)}\n` +
              `TP1: ${formatPrice(tp1!)}`;
          }
        }

        if (message) {
          await sendTelegram(message);
          notifications++;
        }

        const { error: updateError } = await supabase
          .from("crypto_signal_monitors")
          .update(updates)
          .eq("id", signal.id);

        if (updateError) throw updateError;
      } catch (signalError) {
        errors.push(
          `${signal.symbol}: ${
            signalError instanceof Error
              ? signalError.message
              : "неизвестная ошибка"
          }`,
        );
      }
    }

    return json({
      success: true,
      checked: signals.length,
      notifications,
      errors,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка мониторинга",
      },
      500,
    );
  }
});
