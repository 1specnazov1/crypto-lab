# CRYPTO LAB v79 — Signal Quality v15 Recovery & Evidence

Updated: 2026-08-14  
Supabase project: `txhzxbizjpinowepfjkm`  
Scope: v79 scanner / SHADOW lifecycle / signal quality / Backtest parity. Stable v78 is not modified.

## Production state

- `crypto-market-scanner`: internal Scanner v15.
- Scanner cron job 45: active every 15 minutes.
- Scanner mode: `dry_run=true` / SHADOW.
- Scanner coverage per run: `5M`, `1H`, `4H`.
- Canonical SHADOW lifecycle source: `public.crypto_shadow_signals`.
- `crypto-shadow-signal-monitor`: recovery-aware monitor v5; cron job 63 active every minute.
- LIVE `crypto-signal-monitor`: cron job 62 exists but remains inactive.
- Telegram LIVE publication: OFF.
- Operational watchdog job 64: active every 5 minutes.
- Research-only Scanner market-universe snapshot job 65: active every 15 minutes.

## Canonical SHADOW lifecycle

Scanner v15 stores only its actual production `class_a` decisions after global ranking / TOP-3 selection and production dedupe into `public.crypto_shadow_signals`.

Lifecycle:

`WAITING → ACTIVE / ENTRY → TP1 → TP2 → TP3 / BREAKEVEN / PROTECTED_TP1 / STOP`

If the entry zone is never reached before the timeframe-specific deadline, the signal becomes `EXPIRED` and is not counted as a losing trade.

Entry deadlines:

- 5M: 6 hours.
- 1H: 24 hours.
- 4H: 72 hours.

The old `public.crypto_shadow_signal_monitors` table is deprecated and is not an authoritative source.

## Recovery-aware Monitor v5

Monitor v5 reads Binance 1-minute high/low history and is able to recover the complete lifecycle after downtime rather than expiring a signal solely because its scheduled check was missed.

Processing rules:

1. Reconstruct minute bars from the signal's prior checkpoint, or from the first full minute after signal creation when never checked.
2. Detect actual entry-zone overlap before the entry deadline.
3. Once an entry is possible, use conservative Stop-first handling for same-1m ambiguity.
4. TP1 moves managed Stop to the midpoint of the entry zone (`BREAKEVEN`).
5. TP2 moves managed Stop to TP1 (`LOCK_TP1`).
6. TP3 closes the scenario successfully.
7. Later protected exits are recorded as `BREAKEVEN` or `PROTECTED_TP1`.

### Recovery proof

Two historical 5M SHORT SHADOW candidates that previously appeared stale were reset and replayed from Binance 1m data:

- MMT 5M SHORT: actual ENTRY was recovered, followed by STOP; realized result `-1R`.
- BTC 5M SHORT: actual ENTRY, TP1, TP2 and TP3 were recovered; realized result approximately `+2.5R`.

This changed the sample from two artificial expirations to two evidence-backed completed trades.

## Current forward evidence

At the latest verified 7-day snapshot:

| Bucket | Signals | Entered | Closed | TP1 | TP2 | TP3 | STOP | Avg R | PF | Release |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 5M SHORT | 2 | 2 | 2 | 1 | 1 | 1 | 1 | +0.75R | 2.50 | NOT READY |

The positive two-trade result is not statistically sufficient. The release blocker remains sample size: at least 30 completed observations are required in an enabled timeframe/direction bucket before the minimum statistical gate can pass.

## Admin quality report

`public.get_crypto_shadow_quality_admin(hours)` reads the canonical SHADOW table and powers Admin → Signals & Telegram windows for 24h / 7d / 30d.

Per timeframe/direction it reports:

- signals / entered / closed / expired;
- TP1 / TP2 / TP3;
- breakeven / protected-profit / STOP;
- win rate;
- average realized R;
- Profit Factor;
- aggregate max drawdown in R.

Minimum release criteria encoded in the current report:

- at least 30 closed trades in the bucket;
- positive average R;
- Profit Factor at least 1.15.

These are minimum gates, not a guarantee of future profitability.

## Scanner v15 signal model

Scanner v15 evaluates:

- EMA 20/50/200 structure and slope;
- RSI regime by timeframe and direction;
- ATR volatility / risk-distance caps;
- ADX and `+DI/-DI`;
- MACD histogram and acceleration;
- relative volume;
- candle close location, body/ATR and range/ATR;
- BTC primary/context bias;
- multi-timeframe context: 5M → 1H/4H, 1H → 4H/1D, 4H → 1D;
- liquidity and 24-hour range filtering;
- stablecoin / pegged / leveraged-token exclusions;
- recent market-news direction and Impact.

5M keeps the more mature continuation/breakout structure. 1H/4H use stricter confirmation. 1H SHORT and 4H SHORT may be observed in SHADOW but remain blocked from LIVE registration with `QUALITY_GATE_SHORT_DISABLED`.

## Backtest modes

### Scanner v15 EXACT

`SCANNER_V15_EXACT` is deliberately implemented as **Production Decision Replay**, not as a reconstructed historical approximation.

Source: canonical `public.crypto_shadow_signals`.

Therefore it preserves:

- the actual Scanner v15 global TOP-3 decisions;
- production dedupe;
- the real timeframe/direction/setup/strength selected at run time;
- Monitor v5 Binance 1m lifecycle results.

Exact coverage begins when production SHADOW decision capture was enabled. Requests for older windows are visibly truncated to the true coverage start. The engine does not invent pre-coverage Scanner decisions.

The UI can model capital, risk, leverage and fees over those actual decisions. Slippage and funding are not modeled.

### Classic

Classic remains the configurable historical EMA/RSI/ATR simulation and is the appropriate mode for periods before exact production-decision coverage.

The separate market-rank snapshot archive is retained for future research and historical simulation work, but it is **not** claimed as the authoritative source of Scanner v15 EXACT decisions.

## Telegram management

LIVE remains OFF.

When LIVE is eventually authorized:

- ENTRY message includes original Stop and management plan.
- TP1 message explicitly instructs moving Stop to breakeven.
- TP2 message explicitly instructs moving Stop to TP1.
- TP3 / STOP / BREAKEVEN / PROTECTED_TP1 are separate lifecycle events.

Telegram pre-flight exists in Admin and verifies bot API, chat access, monitor authentication and queue health. A TEST message is sent only by explicit admin action.

## Activation gate

Do not enable LIVE Telegram solely because v15 is deployed or because an early sample is profitable.

Before enabling a timeframe/direction bucket, require at minimum:

- 30 completed forward SHADOW trades; 50 is preferred for stronger confidence;
- positive expectancy after fees;
- Profit Factor ≥ 1.15;
- acceptable maximum drawdown;
- no unresolved Binance / monitor / Telegram delivery incidents;
- separate review of TP1, TP2, TP3, breakeven, protected-profit and STOP distributions.

## Fail-closed recovery

Ensure LIVE monitor remains off:

```sql
select cron.alter_job(62, active := false);
```

Verify signal jobs:

```sql
select jobid,jobname,schedule,active
from cron.job
where jobname in (
  'crypto-market-scanner-every-15-minutes',
  'crypto-signal-monitor-every-minute',
  'crypto-shadow-signal-monitor-every-minute',
  'crypto-ops-watchdog-5m'
)
order by jobid;
```

Do not store Telegram tokens, service-role keys or runtime monitor secrets in GitHub, browser code or recovery documentation.
