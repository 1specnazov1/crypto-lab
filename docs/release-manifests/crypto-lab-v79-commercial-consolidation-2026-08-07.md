# CRYPTO LAB v79 — Commercial readiness consolidation

Date: 2026-08-07
Stable public version: v78
Commercial candidate: v79 build 7930
Project: CRYPTO LAB

## Executive status

The technical commercial-preparation cycle is complete to the safe prelaunch boundary. The candidate is **not authorized for production launch**.

Verified at consolidation time:

- stable root v78 Git blob SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- v79 remains a separate preview candidate and has not been promoted over v78;
- Supabase Security Advisor: 0 security lints;
- paid checkout: false;
- paid entitlement: false;
- public registration: false;
- recurring billing: false;
- refund execution: false;
- production launch authorization: false;
- Auth users: 0;
- billing orders: 0;
- billing events: 0;
- on-chain claims: 0;
- active subscriptions: 0;
- closed beta mode: `prepared_inactive`;
- beta checklist: 60 passed, 180 blocked_external, 0 pending;
- no real users were invited.

## Completed safe blocks

1. **Testnet payment contour** — RPC connectivity, exact 0.01 testnet USDC transfer templates, verifier-positive fixtures and negative rejection fixtures prepared. No transaction was signed or broadcast.
2. **Mainnet RPC/indexer** — Ethereum, Solana and TRON read-only/inactive profiles prepared; write methods remain denied and runtime activation is zero.
3. **Transaction monitoring/invoices** — payment-observation, invoice-expiry and duplicate-credit protection prepared in inactive mode.
4. **Commercial plans** — BASIC $20/month and PRO $49/month prepared but inactive; paid entitlement remains off.
5. **Registration/account portal** — closed prelaunch registration, login, recovery and account portal contract prepared with database-level owner gates; no Auth users exist.
6. **Plan lifecycle/account history/support** — tariff status, expiry, payment history, end-of-period cancellation logic and support surfaces prepared without enabling recurring billing or refunds.
7. **Legal package** — Terms of Use, Privacy Policy, Refund Policy and Risk Disclosure drafts prepared for v79; publication remains unauthorized.
8. **Security audit** — RLS/admin-RPC hardening completed; final Supabase Security Advisor result is zero lints.
9. **Prelaunch monitoring** — fail-closed monitoring for unexpected billing/on-chain/auth/admin activity prepared; latest recorded snapshot is clean.
10. **Closed beta rehearsal** — 20 synthetic personas and 12 scenarios prepared; no real invitations or Auth accounts created.
11. **Integration rehearsal** — safe rollback-based tests performed; duplicate billing and notification protections passed; auth gates hardened.
12. **Release-candidate audit** — v78 preservation contract passed; late security findings were fixed and re-audited to zero lints.

## External blockers that remain

### A. Testnet funding and owner signatures

The testnet transfer templates are ready, but the two live transfers were not executed because:

- Ethereum Sepolia sender needs Sepolia ETH and Circle test USDC;
- Solana Devnet sender needs Devnet SOL and Circle test USDC;
- Circle faucet requires human reCAPTCHA;
- Solana faucet paths were externally unavailable/restricted during the probe;
- final transfers require the owner wallet to sign them externally.

No seed phrase, private key or wallet password is required by CRYPTO LAB and none is stored.

### B. Dedicated production RPC/indexer inputs

Before any mainnet activation, dedicated production endpoints are still required:

- Ethereum mainnet RPC URL;
- Solana mainnet RPC URL;
- TRON mainnet RPC URL;
- TronGrid API key.

The existing mainnet preparation stays read-only/inactive until a separate owner activation decision.

### C. Closed-beta authorization and real test identities

The beta framework is prepared but inactive. The remaining 180 checklist rows intentionally require one or more of:

- explicit owner authorization for a closed beta;
- isolated Auth test accounts;
- external testnet-wallet actions;
- external mail/CAPTCHA infrastructure where applicable.

No real user invitation has been issued.

### D. Legal operator information

The legal drafts cannot be finalized or published until the operator package is supplied/reviewed. Missing items currently recorded in Supabase:

- operator legal name;
- operator registration ID, if applicable;
- operator legal address;
- support email;
- privacy contact;
- governing law;
- served-markets legal review;
- final legal review.

Legal publication authorization remains false.

### E. Owner/platform security controls

Database-level controls are hardened, but two platform-level items cannot be proven from the database:

- verify 2FA on the owner accounts used for Supabase and GitHub before enabling an admin browser surface;
- verify Supabase backup/PITR retention and complete a restore rehearsal before production authorization.

### F. CI verification debt

The current GitHub head has no combined status entries returned by the connector. Therefore this consolidation does **not** claim a successful CI result for the latest head. The repository evidence and Supabase checks are recorded separately.

## Owner decision package

The project should remain in prelaunch state until the following decisions/inputs are independently completed:

1. **Closed beta decision** — whether to authorize a 10–20 user isolated beta and create test Auth identities.
2. **Infrastructure decision** — select/provide dedicated Ethereum, Solana and TRON RPC providers plus TronGrid credentials for read-only production preparation.
3. **Legal/operator package** — provide operator identity/contact/jurisdiction details and approve final legal review scope.
4. **Security readiness confirmation** — confirm owner 2FA for GitHub/Supabase and complete backup/PITR restore rehearsal.
5. **Testnet execution decision** — optionally fund the prepared testnet wallets and sign the two 0.01 testnet USDC transfers to close the live verifier path.
6. **Production launch decision** — only after all prior blockers are closed, separately authorize or reject mainnet payments, paid entitlement, public registration, recurring billing/refunds and v79 promotion. These must not be treated as one implicit approval.

## Release recommendation

**Technical candidate status:** READY FOR OWNER-GATED CLOSED BETA PREPARATION, with external blockers.

**Commercial production status:** NOT READY / NOT AUTHORIZED.

**Stable public release:** keep v78 unchanged.

No mainnet payment, real transfer, registration, paid tariff, refund execution, real-user invitation or v79 promotion was enabled by this consolidation.