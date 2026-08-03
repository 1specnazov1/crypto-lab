# CRYPTO LAB v79 — Binance import profiles and journal analytics

Applied to Supabase project `txhzxbizjpinowepfjkm` on 2026-08-03 through migration `crypto_lab_v79_journal_exchange_analytics`.

## Journal schema extension

The `crypto_trade_journal` table now stores:

- exchange (`MANUAL`, `BINANCE`, `OTHER`);
- market type (`SPOT`, `FUTURES`, `MARGIN`, `OTHER`);
- quote asset;
- external exchange trade/order ID;
- exchange-reported realized P&L;
- signed funding fee.

`realized_pnl` remains a generated column. For imported exchange trades it uses the exchange-reported realized P&L when available, then subtracts commissions and funding. Otherwise it uses the journal entry/exit price calculation. `r_multiple` uses the same final P&L against the saved stop risk.

A partial unique index prevents the same exchange trade ID from being stored twice for one user, exchange and market type. Existing SHA-256 import fingerprint deduplication remains active.

## Analytics RPC

`get_my_crypto_journal_analytics(days)` is executable only by authenticated users and reads only rows owned by `auth.uid()`.

It returns:

- trades, wins, losses and breakeven count;
- win rate, net P&L, gross profit/loss and Profit Factor;
- average trade, average R and average holding time;
- best and worst trade;
- maximum win and loss streaks;
- cumulative daily P&L curve;
- grouped results by symbol, LONG/SHORT and strategy.

## Frontend

- `v79/journal-import.js` supports Auto, Generic CSV/JSON, Binance Spot and Binance Futures profiles.
- Binance Spot uses FIFO matching of buys to later sells. Remaining inventory is saved as an open LONG position.
- Binance Futures imports closing fills that contain `Realized Profit`; exchange P&L is used even when the export lacks the historical entry price.
- CSV delimiter auto-detection supports comma, semicolon and tab-separated files.
- `v79/journal-analytics.js` renders period filters, summary metrics, cumulative P&L, and grouped performance tables in RU/UA/EN.
- Build 7908 loads the analytics inside the main terminal and caches it for PWA use.

## Verification

A temporary authenticated user received five closed trades with expected generated P&L values: `100`, `-50`, `30`, `20`, `-10` USDT. The analytics RPC returned 5 trades, 60% win rate, 90 USDT net P&L, Profit Factor 2.5 and the expected 5-point equity curve. A duplicate Binance external trade ID was rejected by the unique index. Deleting the test Auth user cascaded to zero journal, profile and subscription rows.

A temporary public validator checked 21 v79 files on GitHub Pages. Every file returned HTTP 200 and all JavaScript, embedded scripts and the web manifest passed syntax parsing. The validator was then restored to mandatory JWT protection.

## Known limitations

- Binance Futures trade-history exports may not contain historical entry prices. Such rows preserve exchange-reported realized P&L but cannot calculate an accurate R multiple unless the user later supplies a stop and entry context.
- Spot FIFO results depend on the uploaded file containing enough earlier BUY history. Unmatched SELL quantity is reported and skipped.
- Fees paid in third-party assets such as BNB are noted but are not converted to quote currency without historical conversion data.
