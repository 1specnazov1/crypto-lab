# CRYPTO LAB v79 — AI reliability and commercial telemetry build 7914

Applied to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7914` on 2026-08-03. The working v78 application was not modified.

## AI request ledger

Migrations:

- `crypto_lab_v79_ai_run_telemetry`
- `crypto_lab_v79_ai_runs_privilege_hardening`

The new `crypto_ai_runs` table records operational metadata for protected AI requests:

- user, time, status and language;
- market symbol and timeframe;
- question/context/response character counts;
- model and upstream request identifier;
- server duration;
- input, output and total token usage;
- response quality score and individual quality flags;
- normalized failure code/message;
- tariff and remaining quota after the request.

Raw user questions, raw market context and generated AI answers are not stored in this ledger.

RLS permits an authenticated user to read only their own rows. Browser roles cannot insert, update or delete telemetry. `anon` has no table privileges. Operational writes are performed with `service_role` inside the protected Edge Function.

## AI Edge Function version 8

`crypto-ai-advisor` remains protected by mandatory JWT verification.

Improvements:

- the user identity is verified through Supabase Auth rather than trusting an unverified decoded JWT payload;
- request body size is limited;
- per-user rate limiting remains active and cleans expired in-memory buckets;
- every accepted, rejected or failed request is written to the server ledger;
- tariff consumption is recorded with plan, limit and remaining allowance;
- OpenAI response duration and token usage are recorded;
- upstream errors are normalized and raw provider details are not exposed to the browser;
- response text is checked for minimum length, Markdown structure, risk language, Stop Loss and a financial-advice disclaimer;
- the prompt now requires five stable Markdown sections in RU, UA or EN;
- the response remains plain structured text compatible with the existing v79 AI interface.

The quality score is diagnostic only. It does not claim trading accuracy or profitability.

## Administrator diagnostics

Build `7914` adds `v79/admin-ai-telemetry.js` to the existing protected admin page.

The panel provides 24-hour, 7-day, 30-day and 90-day views of:

- request count, completion rate and unique users;
- quota and rate-limit rejections;
- average and P95 response duration;
- total token usage;
- average response quality score;
- model-level request/token/latency summaries;
- normalized error distribution;
- recent rejected/failed requests without storing question or answer content.

The RPC `get_crypto_admin_ai_telemetry(days)` is callable only by signed-in clients and rejects every account whose protected profile role is not `admin`. `anon` cannot execute it.

## PWA and mobile

Build `7914` loads both the backtest and AI admin diagnostics scripts. The service worker caches `admin-ai-telemetry.js` together with the existing shared mobile stylesheet and all core v79 modules.

## Verification

- the Edge Function deployed successfully as version 8 with mandatory JWT verification;
- `anon` cannot read `crypto_ai_runs`;
- authenticated users can select only through RLS and cannot insert records;
- `anon` cannot execute the AI admin telemetry RPC;
- the build validator confirmed HTTP 200 for 14 current v79 files;
- build `7914`, AI telemetry injection, backtest telemetry injection and mobile/PWA markers were confirmed;
- the temporary validator was restored to mandatory JWT protection.

A paid end-to-end OpenAI request was not generated solely for deployment validation, so no real AI quota or provider cost was consumed during this block. The first normal authenticated AI request will populate the new telemetry ledger.

## Next recommended block

Add user-facing AI request history without storing private prompts, including date, market, timeframe, status, duration, quality score and token class. Then add a controlled AI evaluation suite with fixed market snapshots to detect prompt regressions before commercial releases.
