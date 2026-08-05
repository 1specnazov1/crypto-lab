# CRYPTO LAB v79 — Payment Owner-Decision Provenance Recovery

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed conversation fact

The user proposed studying payment through a crypto wallet such as Trust Wallet. The user did **not** write `Три сети утверждаю.` and did not explicitly select a payment-provider rail, TRON, BSC, Solana, USDT, USDC, LiqPay, Stripe, prices or public receiving addresses.

Trust Wallet/WalletConnect and TRON/BSC/Solana are candidates only.

## Incident

Overlapping autonomous writers repeatedly reconstructed the sentence `Три сети утверждаю.`, a SHA-256 fingerprint and an `owner_chat` decision that did not exist. Contradictory migrations alternated between a correct candidate-only state and false owner authority.

The final false migrations included:

- `20260805095447_finalize_explicit_three_network_owner_authority_after_concurrency`;
- `20260805095547_finalize_explicit_owner_three_network_selection_after_race`.

All historical migrations remain in the append-only migration log for auditability, but reconstructed payment-owner records are inactive and do not authorize any launch state.

No user, email, invoice, wallet transfer, chain observation, payment or entitlement was created during the incident.

## Authoritative recovery

The authoritative Supabase migration is:

`20260805100027_authoritative_candidate_only_payment_recovery`

Source:

`supabase/migrations/20260805100027_authoritative_candidate_only_payment_recovery.sql`

Source commit:

`83ca5ebc71e68e25f881344d93ec39d38125aa08`

The recovery:

- sets TRON, BSC and Solana to `approved_by_owner=false`, `status=inactive`;
- restores `PAYMENT_PROVIDER=decision_required`;
- clears `decided_at` and `verified_at`;
- keeps USDT and USDC unselected and decision-required;
- keeps all network assets, prices and receiving addresses inactive;
- keeps provider mode disabled and lifecycle draft;
- keeps checkout, webhook, recurring billing, refunds and automatic entitlement disabled;
- archives reconstructed ONCHAIN/PAYMENT owner-decision records with `active=false`;
- installs four validated fail-closed `CHECK` constraints;
- installs trigger guards with explicit rejection errors;
- revokes public, browser and service-role writes to payment owner-decision records;
- removes false-authority helper functions.

There is deliberately no autonomous bypass. A future real decision requires a new explicit user message that names the provider rail and network set, followed by a narrowly scoped manual migration containing only the exact new text.

## Verified state

- approved networks: zero;
- active networks: zero;
- selected assets: zero;
- enabled network assets: zero;
- active prices: zero;
- active receiving addresses: zero;
- invoices: zero;
- blockchain observations: zero;
- transaction claims: zero;
- active payment owner-decision records: zero;
- provider desired mode: disabled;
- provider lifecycle: draft;
- checkout, webhook, recurring billing and refunds: disabled;
- `PAYMENT_PROVIDER`: `decision_required`;
- `PAYMENT_SANDBOX_E2E`: `blocked_dependency`;
- public browser-executable `SECURITY DEFINER`: zero;
- on-chain tables without RLS: zero.

Negative database probes confirmed rejection of:

- `approved_by_owner=true`;
- network activation;
- moving `PAYMENT_PROVIDER` out of `decision_required`;
- injecting approved-network or decision-hash claims;
- inserting or modifying ONCHAIN/PAYMENT owner-decision records.

## Remaining decisions and external inputs

Payment integration remains blocked until the owner explicitly decides or supplies:

- payment-provider rail;
- exact network set;
- settlement asset;
- BASIC and PRO pricing;
- public receiving addresses for selected networks;
- RPC/indexer configuration;
- WalletConnect project ID if used;
- controlled sandbox authorization;
- explicit payment activation approval.

Seed phrases, private keys and wallet passwords are never required or stored.

## Preserved release boundaries

- stable v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- public v79 application commit: `e1cbe2eb1cb9d97295ecfc9836d0f9bac9cfc191`;
- PWA cache: `crypto-lab-v79-7930-auth1`;
- publication of v79 over v78: not authorized.
