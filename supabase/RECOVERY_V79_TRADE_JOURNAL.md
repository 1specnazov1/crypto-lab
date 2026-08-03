# CRYPTO LAB v79 — Trade journal

Applied to Supabase project `txhzxbizjpinowepfjkm` on 2026-08-03 through migrations:

- `crypto_lab_v79_trade_journal`
- `crypto_lab_v79_journal_import_dedup`

## Database

The `public.crypto_trade_journal` table stores authenticated users' trade records:

- symbol, timeframe, LONG / SHORT direction and OPEN / CLOSED / CANCELLED status;
- entry and exit timestamps and prices;
- stop, take profit, quantity, leverage and fees;
- strategy, setup, notes and tags;
- source type: manual, scanner or import;
- optional scanner source identifier;
- SHA-256 import fingerprint;
- generated `realized_pnl`, `risk_amount` and `r_multiple` values.

P&L is calculated from asset quantity, not margin: LONG uses `(exit - entry) × quantity - fees`; SHORT uses `(entry - exit) × quantity - fees`. Leverage is stored as trade metadata and is not applied twice.

## Security and idempotency

- Row Level Security is enabled.
- Authenticated users can select, insert, update and delete only rows where `user_id = auth.uid()`.
- Anonymous access is revoked.
- `user_id` defaults to `auth.uid()` and references `auth.users` with cascading deletion.
- Database constraints validate symbols, timeframes, directions, statuses, prices, quantity, leverage, fees and timestamp order.
- Closed trades require an exit price and exit time.
- A partial unique index on `(user_id, source_signal_id)` prevents one scanner signal from being added twice.
- A partial unique index on `(user_id, import_fingerprint)` makes repeated CSV or JSON imports idempotent per user.
- Import fingerprints must be lowercase 64-character SHA-256 hex strings.

## Scanner bridge

- `v79/scanner-actions.js` adds Chart and Journal actions to every filtered scanner signal.
- Journal transfer preserves symbol, timeframe, direction, signal ID, signal status, strength, entry range, selected entry, Stop, TP1, TP2, TP3 and signal timestamp.
- `v79/app-extension.js` opens the Journal module inside the main terminal and forwards the draft parameters once, then removes them from the browser URL.
- `v79/journal-import.js` enriches the draft with scanner strategy, setup, tags and notes. The user still confirms quantity and entry price before saving.

## History import

- CSV and JSON files are supported.
- The CRYPTO LAB export format can be imported again.
- Common aliases such as Symbol, Pair, Side, Position Side, Entry Price, Exit Price, Qty, Commission, Open Time and Close Time are recognized.
- BUY maps to LONG and SELL maps to SHORT.
- Quote suffixes such as USDT, BUSD, USDC, FDUSD and USD are removed from imported symbols.
- Imports run in chunks of 200 rows, with a maximum of 5000 rows per file.
- SHA-256 fingerprints are generated in the browser and duplicate rows are ignored by the database.
- A downloadable CSV template is available in the journal header.

## Frontend

- `v79/journal.html` provides the responsive journal interface.
- `v79/journal.js` implements authenticated CRUD, filters, CSV export and RU / UA / EN localization.
- `v79/journal-import.js` implements scanner draft enrichment and idempotent CSV / JSON import.
- `v79/scanner-actions.js` implements scanner-to-chart and scanner-to-journal actions.
- The new modules are included in PWA cache build `7907`.

## Verification

A temporary authenticated user inserted the same scanner signal twice with `ON CONFLICT DO NOTHING`; only one scanner journal row remained. The same imported trade and fingerprint were inserted twice; only one imported row remained.

The imported ETH LONG test trade generated `11.0` USDT realized P&L. Deleting the temporary Auth user removed journal, profile and subscription rows through cascade. All temporary data was removed.

The public validator fetched 21 v79 assets, including `scanner-actions.js` and `journal-import.js`. Every file returned HTTP 200, required build markers were present, JavaScript and inline scripts parsed without syntax errors, the manifest parsed successfully and no forbidden secret markers were found. The validator was returned to mandatory JWT verification after testing.

The working v78 site was not modified.