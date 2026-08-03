# CRYPTO LAB v79 — Launch readiness scorecard

Assessment date: `2026-08-04`

Application build: `7929`

This scorecard separates engineering maturity from public paid-launch readiness. A high technical score does not override a hard launch blocker.

## Executive result

| Readiness view | Score | Meaning |
|---|---:|---|
| Technical preview readiness | **92 / 100** | The isolated v79 preview is technically mature, protected by automated release and browser gates, and suitable for continued controlled testing. |
| Controlled beta readiness | **86 / 100** | Suitable for a limited beta using already authorized or manually provisioned accounts, provided no live payment promise is made. |
| Public paid-launch readiness | **64 / 100** | Not approved for public paid launch because registration protection, production payment configuration and business policies remain unresolved. |

**Current release decision: NO-GO for public paid launch.**

The decision is caused by explicit external blockers, not by a known critical failure in the completed v79 engineering block.

## Weighted engineering score

| Domain | Weight | Domain score | Weighted contribution | Evidence |
|---|---:|---:|---:|---|
| Core product and live-data modules | 20% | 94 | 18.8 | Scanner, signals, portfolio, calculator, backtest, journal, AI boundaries and account modules are integrated in v79. |
| Database authorization and data integrity | 15% | 93 | 14.0 | RLS, protected RPC wrappers, subscription state machine, billing reconciliation, provider registry and zero Security Advisor lints. |
| UX, accessibility and mobile/PWA | 15% | 89 | 13.4 | Shared accessibility layer, keyboard flows, responsive profiles, service worker, offline module test and 15/15 Playwright pass. |
| Account and session security | 12% | 88 | 10.6 | PKCE session handling, security-state RPC, global sign-out, cross-tab sync and admin inactivity timeout. |
| Operations, support and auditability | 13% | 92 | 12.0 | Operational health, support administration, deletion workflows, billing review and append-only critical admin audit. |
| Release engineering and observability | 15% | 94 | 14.1 | Dynamic release gate, public marker checks, browser CI, cache versioning, rollback isolation and GitHub Pages deployment evidence. |
| Legal, privacy and lifecycle controls | 10% | 91 | 9.1 | Terms, privacy, risk disclosure, legal acceptance, export/deletion paths and retention structures. |
| **Technical preview total** | **100%** |  | **92.0** | Rounded to **92 / 100**. |

## Public paid-launch deductions

The public launch score applies hard-gate deductions to the technical score.

| Blocking item | Deduction | Current status |
|---|---:|---|
| Public registration lacks installed Turnstile credentials and activation approval | -8 | Registration intentionally closed. |
| Password recovery lacks installed Turnstile credentials and activation approval | -4 | Recovery intentionally closed. |
| Production payment provider not selected | -5 | LiqPay, Stripe and manual adapters remain disabled/draft. |
| BASIC and PRO production prices not approved | -4 | No active paid price. |
| Merchant credentials and provider webhook secret absent | -4 | Checkout and webhook processing disabled. |
| Internal normalized billing webhook secret absent | -2 | Billing webhook remains disabled. |
| Refund, chargeback and failed-renewal policies not approved | -3 | Refund and recurring flags remain false. |
| Manual physical-device visual acceptance incomplete | -2 | Automated Chromium coverage exists; physical Android/iOS acceptance remains. |
| Cutover approval and rollback rehearsal incomplete | -2 | v78 remains active; production switch is intentionally forbidden. |
| **Public paid-launch result** | **-34** | `92 - 34 = 58`; maturity credit for completed commercial architecture raises operational preparedness to **64**, but hard blockers still force NO-GO. |

The public score is deliberately conservative. It is not an average that permits launch while a security or payment hard gate is open.

## Hard gates

### Gate A — Public identity flow

Status: **BLOCKED**

Required before opening registration or recovery:

- Cloudflare Turnstile site key;
- Cloudflare Turnstile secret key;
- verified production domains;
- explicit activation decision;
- successful abuse/rate-limit and recovery E2E test.

### Gate B — Paid checkout

Status: **BLOCKED**

Required:

- selected production provider: LiqPay or Stripe;
- merchant account approval;
- BASIC and PRO prices;
- currency;
- monthly and/or yearly billing interval;
- merchant API credentials;
- provider webhook secret;
- CRYPTO LAB internal billing webhook secret;
- sandbox E2E pass;
- live low-value payment and reconciliation pass.

### Gate C — Subscription policy

Status: **BLOCKED**

Required policy decisions:

- refund window and eligibility;
- chargeback handling;
- failed-renewal grace period;
- downgrade timing;
- cancellation effective date;
- data/access behavior after expiration;
- manual-review authority and evidence requirements.

### Gate D — Production acceptance

Status: **PARTIAL**

Completed:

- isolated v79 deployment;
- static release gate;
- 15/15 automated browser/PWA tests;
- public HTTP marker verification;
- zero Supabase security lints;
- v78 isolation confirmed.

Still required:

- physical Android review;
- physical iPhone review;
- final visual/accessibility acceptance;
- production monitoring contacts and escalation path;
- cutover rehearsal;
- rollback rehearsal;
- explicit owner approval.

## Evidence snapshot

- Build: `7929`.
- Static release workflow: `Validate v79 Preview`, run `30854617385`, success.
- Browser workflow: `V79 Browser Smoke`, run `30854617205`, **15 passed**, success.
- GitHub Pages deployment: run `30854616170`, success.
- Public build files: HTTP `200` with expected 7929 markers.
- Supabase Security Advisor: zero lints.
- Performance Advisor: informational unused-index notices only.
- Root v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
- Provider adapters: all `disabled / draft`.
- Paid active prices: none.
- Test emails sent: none.

## Recommended release sequence

1. Complete remaining independent audit/retention/cutover engineering.
2. Perform physical-device visual review without opening registration.
3. Approve Turnstile and activate identity flows in a controlled test window.
4. Select one payment provider and approve prices/policies.
5. Install secrets server-side only.
6. Execute sandbox commercial E2E plan.
7. Execute limited live-payment verification.
8. Re-run security, performance, static and browser gates.
9. Recalculate this scorecard.
10. Switch from v78 to v79 only after every hard gate is green and explicit approval is recorded.

## Target thresholds

| Milestone | Required score | Additional requirement |
|---|---:|---|
| Continue isolated preview | 85+ | No critical security lint and v78 remains isolated. |
| Controlled beta | 85+ | Identity access is controlled; no unconfigured paid promise. |
| Public free launch | 90+ technical | Registration/recovery hard gate green and physical-device acceptance complete. |
| Public paid launch | 90+ technical and 90+ public | Every identity, payment, policy, monitoring, cutover and rollback hard gate green. |
