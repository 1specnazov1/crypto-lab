# CRYPTO LAB v79 — Trade journal

Applied to Supabase project `txhzxbizjpinowepfjkm` on 2026-08-03 through migration `crypto_lab_v79_trade_journal`.

## Database

The `public.crypto_trade_journal` table stores authenticated users' manual trade records:

- symbol, timeframe, LONG / SHORT direction and OPEN / CLOSED / CANCELLED status;
- entry and exit timestamps and prices;
- stop, take profit, quantity, leverage and fees;
- strategy, setup, notes and tags;
- optional scanner source identifier;
- generated `realized_pnl`, `risk_amount` and `r_multiple` values.

P&L is calculated from asset quantity, not margin: LONG uses `(exit - entry) × quantity - fees`; SHORT uses `(entry - exit) × quantity - fees`. Leverage is stored as trade metadata and is not applied twice.

## Security

- Row Level Security is enabled.
- Authenticated users can select, insert, update and delete only rows where `user_id = auth.uid()`.
- Anonymous access is revoked.
- `user_id` defaults to `auth.uid()` and references `auth.users` with cascading deletion.
- Database constraints validate symbols, timeframes, directions, statuses, prices, quantity, leverage, fees and timestamp order.
- Closed trades require an exit price and exit time.

## Frontend

- `v79/journal.html` provides the responsive journal interface.
- `v79/journal.js` implements authenticated CRUD, filters, CSV export and RU / UA / EN localization.
- Dashboard metrics include closed trades, open trades, win rate, net P&L, Profit Factor and average R.
- `v79/app-extension.js` routes the existing Journal navigation item to the new module.
- The journal is included in PWA cache build `7906`.

## Verification

A temporary authenticated user inserted a closed BTC LONG trade through RLS. PostgreSQL generated:

- realized P&L: `23` USDT;
- risk amount: `10` USDT;
- R multiple: `2.30R`.

Deleting the Auth user removed the journal row through cascade. The temporary user and all test data were removed.

The public validator fetched all 24 v79 assets, including `journal.html` and `journal.js`. Every file returned HTTP 200 and all JavaScript and inline scripts parsed without syntax errors. The validator was returned to mandatory JWT verification after testing.

The working v78 site was not modified.