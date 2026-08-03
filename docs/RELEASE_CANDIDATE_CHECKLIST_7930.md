# CRYPTO LAB v79 — Release Candidate checklist

Build: `7930`

A release candidate can be marked `approved` only when every mandatory item below has evidence. Items marked external cannot be completed by application code alone.

## A. Repository and static build

- [ ] Immutable Git commit SHA recorded.
- [ ] `Validate v79 Preview` completed successfully for that SHA.
- [ ] `V79 Browser Smoke` completed successfully for that SHA.
- [ ] GitHub Pages deployment completed successfully for that SHA.
- [ ] `index.html`, `app.html`, `commercial-extension.js` and `service-worker.js` use the same build.
- [ ] Service-worker cache name matches the build.
- [ ] Public assets contain no service-role, payment, Turnstile, mail, OpenAI or Telegram secrets.
- [ ] Root v78 file SHA is unchanged.

## B. Browser, accessibility and PWA

- [ ] Mobile Chromium 390×844 passes.
- [ ] Mobile Chromium 412×915 passes.
- [ ] Desktop Chromium 1440×900 passes.
- [ ] No body-level horizontal overflow.
- [ ] Visible buttons and form controls have accessible names.
- [ ] Keyboard skip link, focus order and Escape behavior pass.
- [ ] Reduced-motion rules apply.
- [ ] Manifest and Service Worker register correctly.
- [ ] Cached Calculator module opens offline.
- [ ] Update and old-cache cleanup flow passes.
- [ ] External: physical iOS visual and interaction review completed.
- [ ] External: physical Android visual and interaction review completed.

## C. Database and RPC security

- [ ] All CRYPTO LAB public tables have RLS enabled.
- [ ] No direct `anon` or normal-user access exists for protected audit, retention or release-checkpoint tables.
- [ ] No public `SECURITY DEFINER` function is executable directly by `anon` or `authenticated` unless explicitly reviewed.
- [ ] Public browser wrappers are `SECURITY INVOKER` where designed.
- [ ] Admin-only RPCs reject normal users.
- [ ] Supabase Security Advisor has no unresolved security lint.
- [ ] Performance Advisor has no missing foreign-key index warning.
- [ ] Migration list and corrective rollback plan are recorded.

## D. Edge Functions

For each active function:

- [ ] Function version and source hash recorded.
- [ ] `verify_jwt` state is intentional.
- [ ] Allowed methods are explicit.
- [ ] Origin policy is explicit where browser access exists.
- [ ] Request-body limit exists for write operations.
- [ ] Authentication and authorization are separate checks.
- [ ] Service-only functions require service-role or protected server secret.
- [ ] Error responses do not expose secrets or raw provider payloads.
- [ ] Disabled functions fail closed.

Special requirements:

- [ ] Telegram dispatch accepts only the protected server contour.
- [ ] Mail dispatch contains no hardcoded cross-project key or URL.
- [ ] Server validator checks the current build, not a stale build.
- [ ] Billing webhook remains disabled until adapter signature verification is complete.
- [ ] Registration and recovery remain disabled until Turnstile and mail are verified.

## E. Scheduled operations

- [ ] Signal monitor cron is active and fresh.
- [ ] Market scanner cron is active and fresh.
- [ ] Subscription lifecycle cron is active.
- [ ] Billing retry cron is active.
- [ ] Billing reconciliation cron is active.
- [ ] Daily maintenance cron is active.
- [ ] No unexplained cron failure exists in the preceding 24 hours.
- [ ] Scanner warnings are reviewed for unsupported or insufficient-history markets.

## F. Data protection and operations

- [ ] User data export tested with a controlled account.
- [ ] Account deletion tested with rollback-safe evidence.
- [ ] Admin audit records critical state transitions without tokens, secrets, raw payloads or support text.
- [ ] Retention preview matches approved policy.
- [ ] Maintenance completes and records deletion counters.
- [ ] External: managed backup frequency and retention confirmed.
- [ ] External: point-in-time recovery availability confirmed.
- [ ] External: restore exercise completed and dated.
- [ ] Incident owner and escalation contacts recorded outside the public repository.

## G. Registration and recovery

- [ ] External: Cloudflare Turnstile site key installed.
- [ ] External: Cloudflare Turnstile secret key installed.
- [ ] Registration feature flag remains false until the final test.
- [ ] Recovery feature flag remains false until the final test.
- [ ] Mail relay URL and publishable key installed as server environment variables.
- [ ] Protected relay secret installed.
- [ ] Signup confirmation email tested with an approved internal address.
- [ ] Recovery email tested with an approved internal address.
- [ ] Rate limits, honeypot and legal-consent versions verified.
- [ ] Enumeration-safe duplicate-account behavior verified.

## H. Payments and subscription lifecycle

- [ ] External: production provider selected: LiqPay or Stripe.
- [ ] External: BASIC price approved.
- [ ] External: PRO price approved.
- [ ] External: currency and billing interval approved.
- [ ] Merchant sandbox credentials installed.
- [ ] Provider webhook signing secret installed.
- [ ] Internal normalized webhook secret installed.
- [ ] Adapter remains in test mode until complete E2E evidence.
- [ ] Payment success, failure, expiration and cancellation tested.
- [ ] Duplicate provider event is idempotent.
- [ ] Event-ID collision is rejected and creates review evidence.
- [ ] Renewal and cancellation-at-period-end tested.
- [ ] External: refund, chargeback and failed-renewal policy approved.
- [ ] Refund event tested only after policy approval.

## I. Go / no-go decision

A paid public launch is `NO-GO` when any of these remain unresolved:

- Turnstile keys absent;
- provider not selected or verified;
- BASIC/PRO prices absent;
- merchant or webhook secrets absent;
- refund and cancellation policy absent;
- managed backup/PITR not confirmed;
- physical device review incomplete;
- release-gate, browser-smoke or Pages deployment failure;
- unresolved security lint or billing anomaly.

## Current decision

Build 7930: **technical beta candidate / paid public launch NO-GO**.