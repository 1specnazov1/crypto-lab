# CRYPTO LAB v79 — Provider adapters and browser smoke

Application build: `7928`

Implemented and verified on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 root application was not modified.

## Provider readiness registry

Migration: `crypto_lab_v79_provider_adapter_contracts`.

New protected table: `crypto_billing_provider_adapters`.

It stores only non-secret readiness metadata:

- provider and contract version;
- desired mode: disabled, test, or live;
- lifecycle state: draft, configured, verified, active, or suspended;
- checkout and webhook strategies;
- declared capabilities;
- names of required secrets, never secret values;
- checkout, webhook, recurring-payment, and refund flags;
- last server-side verification time and bounded diagnostics.

Initial adapters:

- LiqPay: hosted redirect plus signed form callback;
- Stripe: Checkout Session plus signed raw-body webhook;
- manual: administrative review only.

All three adapters remain `disabled` and `draft`. Every checkout, webhook, recurring, and refund flag remains false.

Only `service_role` can record successful runtime verification. The browser administrator cannot mark an adapter verified or active.

A rollback-only test used one local Auth admin row without an email address. The admin read the readiness dashboard successfully; the test user was removed by rollback. No email was sent.

## Adapter contract artifacts

Created:

- `docs/PROVIDER_ADAPTER_CONTRACTS_7928.md`;
- `docs/schemas/crypto-billing-normalized-event-v1.schema.json`;
- `docs/E2E_RELEASE_TEST_PLAN_7928.md`.

The normalized-event schema covers:

- provider and immutable provider-event identity;
- internal CRYPTO LAB billing-order UUID;
- normalized payment and subscription event types;
- verified provider order ID;
- monetary amount in minor units and uppercase currency;
- plan and billing interval;
- provider customer/subscription references;
- payment period and bounded metadata.

The adapter contract requires provider-specific signature verification before an event can reach the existing normalized billing webhook. An adapter may not update subscription tables directly.

The end-to-end plan defines gates for:

- static and database safety;
- mobile, desktop, and PWA behavior;
- protected registration and recovery;
- provider sandbox callbacks;
- payment state transitions and idempotency;
- subscription renewal, cancellation, expiry, and refund decisions;
- data export, deletion, support, and final production approval.

## Administrative interface

New v79 module: `admin-provider-readiness.js`.

The admin panel displays:

- adapter mode and lifecycle state;
- checkout and webhook strategy;
- declared capabilities;
- names of missing runtime secrets;
- active price presence;
- blocking conditions;
- last server verification and error code.

The module never reads or displays secret values.

## Build 7928

Updated:

- `v79/index.html`;
- `v79/app.html`;
- `v79/commercial-extension.js`;
- `v79/service-worker.js`.

The service worker now uses cache `crypto-lab-v79-7928` and includes the provider-readiness module.

Public GitHub Pages verification returned HTTP 200 with correct build markers for:

- `index.html`;
- `app.html`;
- `commercial-extension.js`;
- `admin-provider-readiness.js`;
- `service-worker.js`.

## Dynamic release gate

The existing v79 release workflow was expanded to validate:

- build 7928 consistency;
- provider-readiness module presence;
- normalized billing JSON schema parsing;
- JavaScript syntax;
- local HTML references;
- service-worker cached files;
- absence of server-secret identifiers from public v79 assets.

Verified result:

- workflow: `Validate v79 Preview`;
- run ID: `30852432144`;
- conclusion: `success`.

## Browser and PWA smoke automation

Created:

- `package.json` with pinned Playwright test dependency;
- `playwright.config.mjs`;
- `tests/v79-mobile-smoke.spec.js`;
- `.github/workflows/v79-browser-smoke.yml`.

Automated Chromium profiles:

- mobile viewport 390 × 844;
- mobile viewport 412 × 915;
- desktop viewport 1440 × 900.

Checks include:

- application shell and mobile navigation;
- Calculator, Portfolio, Backtest, and Journal module routing;
- iframe rendering;
- body horizontal overflow;
- accessible names for visible buttons;
- PWA manifest;
- service-worker registration and scope;
- offline asset presence;
- language persistence after reload.

The initial run revealed that the iPhone device descriptor selected WebKit while the workflow intentionally installed Chromium only. The test configuration was corrected to use Chromium for every profile.

Verified successful result:

- workflow: `V79 Browser Smoke`;
- run ID: `30852627934`;
- commit: `1935847ff0928295761b2f93bf45d8b530d350d8`;
- tests: `9 passed`;
- conclusion: `success`.

This is automated functional browser validation, not a manual visual-design review on physical phones.

## Security and performance review

After the provider-contract migration:

- Supabase Security Advisor reports zero security lints;
- the provider table is protected by RLS and direct client denial;
- the missing foreign-key index identified by Performance Advisor was added;
- remaining Performance Advisor items are informational unused-index notices on new or currently empty tables.

## Commercial boundary retained

This block did not:

- configure BASIC or PRO prices;
- choose LiqPay or Stripe as the production provider;
- install merchant credentials;
- install the billing webhook secret;
- enable checkout, recurring billing, refunds, registration, or recovery;
- send email;
- replace v78 with v79.

The root v78 `index.html` blob SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

## Remaining external decisions

Production payments remain blocked until the user supplies or approves:

- provider choice;
- BASIC and PRO prices;
- currency and monthly/yearly interval;
- merchant credentials;
- provider webhook secret and internal webhook secret;
- refund, chargeback, failed-renewal, and cancellation rules.

Public registration and password recovery remain blocked until Cloudflare Turnstile keys and explicit activation flags are installed.
