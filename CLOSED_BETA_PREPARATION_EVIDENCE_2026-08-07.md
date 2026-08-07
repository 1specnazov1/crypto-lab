# CRYPTO LAB — Closed Beta Preparation Evidence

Date: 2026-08-07
Candidate: v79 build 7930
Stable public version: v78

## Result

Closed-beta preparation completed in **prepared_inactive** mode. No real users were invited and no `auth.users` accounts were created.

Supabase migration applied:
- version: `20260807010706`
- name: `prepare_closed_beta_rehearsal_v3`

GitHub migration commit:
- `50a7e647fd640017156e97033b4df11d45e7e2d8`

Closed-beta runbook commit:
- `e2ce3413c403dbee938b63076f670e7ce1e72933`

## Verified readiness snapshot

- mode: `prepared_inactive`
- target cohort: 10–20 users
- synthetic persona reservations: 20
- actual Auth users: 0
- prepared scenarios: 12
- checklist rows: 240
- executed checklist rows: 0
- invitations enabled: false
- auth accounts enabled: false
- real payments enabled: false
- mainnet enabled: false
- owner approval required: true
- `safe_to_prepare`: true

Plan coverage across synthetic reservations:
- FREE: 6
- BASIC: 7
- PRO: 7

Scenario coverage:
- auth: 2
- account: 1
- billing: 3
- signals: 1
- notifications: 1
- support: 1
- subscription/cancellation: 1
- security: 1
- release preservation: 1

Wallet-signature scenarios prepared: 3. They remain unexecuted and require a later testnet wallet signature.
Destructive scenarios: 0.
Real-person records/invitations/auth bindings: 0.

## Security verification

All four closed-beta control tables have RLS enabled:
- `crypto_closed_beta_config`
- `crypto_closed_beta_test_personas`
- `crypto_closed_beta_scenarios`
- `crypto_closed_beta_checklist`

For each table:
- `anon` SELECT: false
- `authenticated` SELECT: false
- `service_role` SELECT: true

`crypto_closed_beta_readiness()` execution:
- `anon`: false
- `authenticated`: false
- `service_role`: true

## Commercial safety flags after preparation

All remain false:
- `paid_checkout_enabled`
- `paid_entitlement_enabled`
- `public_registration_enabled`
- `recurring_billing_enabled`
- `refund_execution_enabled`
- `production_launch_authorized`

No payment, registration, subscription, refund or mainnet activation was performed.

## Stable release preservation

Repository root `index.html` SHA verified after the beta-preparation work:
`4a278c891d37b3760ec1ac988690ea9ad587b24e`

This matches the protected v78 control SHA. v79 was not promoted over v78.

## Migration correction record

Two earlier migration attempts failed transactionally during preparation (one email-domain constraint mismatch and one INSERT column-count mismatch). Database checks confirmed that the failed attempts left no partial closed-beta tables. The corrected v3 migration then applied successfully.

## External blockers intentionally not crossed

Before executable closed beta testing, the following still require explicit owner/external action where applicable:
- owner authorization for closed-beta auth activation;
- testnet wallet signatures for payment scenarios;
- Turnstile/mail relay prerequisites if required by the selected auth flow;
- invitation of real beta users;
- any mainnet/payment/paid-entitlement activation;
- any publication of v79 over stable v78.
