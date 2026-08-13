# CRYPTO LAB v79 — Signal Quality v15 Recovery & Evidence

Date: 2026-08-13  
Supabase project: `txhzxbizjpinowepfjkm`  
Scope: scanner/monitor only. Stable v78 is not modified.

## Production state

- `crypto-market-scanner`: Edge Function version 21, internal scanner version 15.
- `crypto-signal-monitor`: Edge Function version 13, internal monitor version 8.
- Scanner cron: active every 15 minutes.
- Scanner execution mode: `dry_run=true` / SHADOW.
- Scanner shadow coverage: `5M`, `1H`, `4H` on every run.
- Telegram live publication: OFF.
- Monitor every-minute cron exists as job 62 but is inactive until the quality gate is passed.
- Open WAITING/ACTIVE signals at rollout: 0.

## Baseline evidence before v15

Final Telegram/outbox outcomes for the recent measured period:

| Timeframe | TP3 | STOP | TP3 share among TP3/STOP |
|---|---:|---:|---:|
| 5M | 12 | 23 | 34.3% |
| 1H | 1 | 8 | 11.1% |
| 4H | 0 | 1 | 0.0% |
| Total | 13 | 32 | 28.9% |

Milestones:

| Timeframe | TP1 | TP2 | TP3 | STOP |
|---|---:|---:|---:|---:|
| 5M | 20 | 15 | 12 | 23 |
| 1H | 7 | 3 | 1 | 8 |
| 4H | 1 | 0 | 0 | 1 |

These counts are historical evidence, not a forecast of future results.

## v15 scanner changes

The scanner now evaluates all three production research timeframes and applies timeframe-specific confirmation rather than one generic rule.

Added metrics and guards:

- EMA 20/50/200 structure and slope.
- RSI regime bounds by timeframe and direction.
- ATR volatility floors/caps and risk-distance caps.
- ADX plus `+DI/-DI` directional strength.
- MACD histogram and histogram acceleration.
- Relative volume.
- Candle close-location, body/ATR and range/ATR quality.
- BTC primary/context bias.
- Multi-timeframe context:
  - 5M → 1H + 4H.
  - 1H → 4H + 1D.
  - 4H → 1D.
- Liquidity and 24-hour range filters.
- Removal of stablecoins, gold-pegged assets, leveraged tokens and tokenized-stock heuristics.
- Recent market-news filter from `crypto_market_news`:
  - opposite high-impact or breaking news can block a candidate;
  - aligned news can add a limited score bonus;
  - news headline, direction and Impact are retained in candidate diagnostics.

Target structure:

- 5M: conservative continuation/breakout model; TP3 remains 2.5R.
- 1H LONG and 4H LONG: stricter ADX/MACD/volume/context confirmation; TP3 is 2.2R.
- 1H SHORT and 4H SHORT: blocked from live registration by `public.register_crypto_signal` with reason `QUALITY_GATE_SHORT_DISABLED`.

## Position management and Telegram wording

Database management remains authoritative:

1. ENTRY — original Stop remains active.
2. TP1 — `managed_stop` moves to the midpoint of the entry zone (breakeven).
3. TP2 — `managed_stop` moves to TP1.
4. TP3 — scenario closes successfully.
5. A later protected stop closes as `BREAKEVEN` or `PROTECTED_TP1`.

Monitor v8 uses recent Binance 1-minute high/low history with conservative Stop-first processing instead of relying only on the latest ticker price. It can sequentially register TP1 → TP2 → TP3 when multiple levels are crossed.

TP1 Telegram message explicitly states:

> ДЕЙСТВИЕ СЕЙЧАС: ПЕРЕНЕСИТЕ STOP В БЕЗУБЫТОК.

TP2 Telegram message explicitly states:

> ДЕЙСТВИЕ СЕЙЧАС: ПЕРЕНЕСИТЕ STOP НА УРОВЕНЬ TP1.

## Validation evidence

- Scanner v15 dry-run completed successfully with 14 symbols and all three timeframes in about 6.4 seconds.
- No candidates during the control run is an acceptable strict-filter result.
- Monitor v8 control invocation returned HTTP 200 with zero open signals, zero queued notifications and zero failures.
- 1H SHORT registration test returned `blocked=true` and inserted no row.
- No historical pending/failed Telegram notifications were claimable at monitor rollout.

## Activation gate

Do not enable live Telegram publication solely because v15 is deployed. Activation requires a separate owner decision after enough shadow evidence is accumulated. Minimum evidence should include:

- at least 30–50 completed signals in each enabled timeframe/direction bucket;
- positive expectancy after fees and modeled slippage;
- Profit Factor above 1.0, with a safer release target above 1.15;
- acceptable maximum drawdown;
- separate TP1/TP2/TP3, breakeven, protected-profit and STOP statistics;
- no unresolved Binance/monitor delivery incidents.

## Recovery

To fail closed immediately:

```sql
select cron.alter_job(62, active := false);
```

The production state at the end of this rollout already has job 62 inactive.

To inspect status:

```sql
select jobid,jobname,schedule,active
from cron.job
where jobname in (
  'crypto-market-scanner-every-15-minutes',
  'crypto-signal-monitor-every-minute'
);
```

Do not place Telegram tokens, service-role keys or `MONITOR_SECRET` in GitHub, browser code or recovery documents.
