# CRYPTO LAB v79 — Protected incident admin observability

Build: `7930`

Verification date: 2026-08-04

This addendum records the protected administrative view added on top of the operational incident ledger.

## Server boundary

The incident view uses:

- `private.get_crypto_admin_operational_incidents()` — `SECURITY DEFINER`, admin-role check, bounded output;
- `public.get_crypto_admin_operational_incidents()` — `SECURITY INVOKER` wrapper.

`anon` cannot execute either function. Authenticated callers can reach the wrapper, but the private implementation rejects callers whose protected CRYPTO LAB profile is not `admin`.

The output contains only operational metadata:

- open and resolved counts;
- open Edge and cron counts;
- oldest open incident age;
- bounded source name, status, severity and occurrence count;
- first/last seen timestamps;
- HTTP status code;
- bounded generic error and recovery note.

It does not expose pg_net response bodies, notification payloads, prices, secrets, tokens or service-role credentials.

## Administrative panel

`v79/admin-incidents.js` renders the ledger inside the existing protected admin dashboard and supports RU, UA and EN.

The panel is loaded only on `admin.html` by `commercial-extension.js`. The PWA cache includes the new asset under cache version:

`crypto-lab-v79-7930-incident1`

Public asset verification:

- `admin-incidents.js`: HTTP 200 and contains the protected RPC/panel markers;
- `commercial-extension.js`: HTTP 200 and contains the incident loader marker;
- `service-worker.js`: HTTP 200 and contains the incident cache and asset marker.

## Natural operational verification

At `2026-08-04 11:45 UTC`, the recreated tracked jobs completed successfully:

- signal monitor;
- market scanner;
- incident reconciliation.

The next reconciliation processed successful Edge responses and reported zero open or resolved incidents.

Latest sampled monitor state:

- current WAITING + ACTIVE signals: `65`;
- checked: `65`;
- HTTP status: `200`;
- missing: `0`;
- notification failures: `0`.

Latest scanner request returned HTTP 200 with `success = true`.

Latest outbox snapshot:

- sent: `30`;
- pending: `0`;
- processing: `0`;
- retry: `0`;
- dead: `0`;
- unique signal-event pairs: `30`.

Supabase Security Advisor returned zero lints after service-only RLS policies were installed on both operational tables.

The working root v78 application remains unchanged at SHA:

`4a278c891d37b3760ec1ac988690ea9ad587b24e`
