# CRYPTO LAB v79 — On-chain Owner Decision Provenance Repair

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed conversation fact

The user proposed exploring payment through a crypto wallet such as Trust Wallet. The user did **not** write `Три сети утверждаю.` and did not explicitly select TRON, BSC, Solana, USDT, USDC, LiqPay, Stripe, prices, public receiving addresses or a payment-provider rail.

TRON, BSC and Solana are candidate networks only.

## Provenance incident

Several overlapping autonomous operations reconstructed an owner decision that did not exist. They created the sentence `Три сети утверждаю.`, a SHA-256 fingerprint, an `owner_chat` provenance claim and approved-network state without an exact user message supporting those records.

The false interpretation recurred through these later migrations:

- `20260805094607_supersede_false_network_decision_denial_with_exact_owner_record`;
- `20260805094628_restore_canonical_owner_three_network_authority`.

Those migrations are retained in immutable migration history for auditability, but their state and evidence are superseded.

No payment provider, blockchain network, settlement asset, price, receiving address, invoice, blockchain observation, wallet transfer or entitlement became active during the incident.

## Final authoritative repair

The authoritative migration is:

`20260805095124_final_restore_candidate_only_after_false_owner_authority`

Source:

`supabase/migrations/20260805095124_final_restore_candidate_only_after_false_owner_authority.sql`

Source commit:

`54861441ffbd1ff1ff2c4da053ecd42fc44948d3`

The final repair:

- sets TRON, BSC and Solana to `approved_by_owner=false` and `status=inactive`;
- restores `PAYMENT_PROVIDER=decision_required`;
- clears `decided_at` and `verified_at`;
- keeps USDT and USDC unselected and decision-required;
- keeps all prices, receiving addresses and network assets inactive;
- keeps checkout, webhook, recurring billing, refunds and automatic entitlement disabled;
- archives the reconstructed owner-decision record with `active=false`;
- archives the later false correction as `invalid_reconstructed_owner_decision_correction`;
- installs validated candidate-only `CHECK` constraints and fail-closed triggers;
- blocks new or modified ONCHAIN/PAYMENT owner-decision records without a future explicit manual migration containing exact user text;
- revokes service-role DML on owner-decision audit records.

## Verified final state

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
- historical invalid owner-decision records: one, inactive;
- historical invalid correction supersessions: one;
- provider mode: disabled;
- provider lifecycle: draft;
- checkout, webhook, recurring billing and refunds: disabled;
- `PAYMENT_PROVIDER`: `decision_required`;
- `PAYMENT_SANDBOX_E2E`: `blocked_dependency`;
- public browser-executable `SECURITY DEFINER`: zero;
- on-chain tables without RLS: zero.

Negative probes confirmed that the database rejects:

- `approved_by_owner=true`;
- network activation;
- changing `PAYMENT_PROVIDER` from `decision_required`;
- inserting approved-network claims;
- inserting a new ONCHAIN owner-decision record.

There is deliberately no autonomous bypass. A real payment decision requires a future, narrowly scoped manual migration after a new user message explicitly selects the provider rail and network set. Only the exact new text may be recorded; it must never be reconstructed.

## Remaining decisions and external inputs

Payment integration remains blocked until the owner explicitly decides or supplies:

- payment-provider rail;
- exact network set;
- settlement asset;
- BASIC and PRO pricing;
- public receiving addresses for the selected networks;
- RPC/indexer configuration;
- WalletConnect project ID if WalletConnect is used;
- controlled sandbox authorization;
- explicit payment activation approval.

Seed phrases, private keys and wallet passwords are never required or stored.

## Preserved release boundaries

- stable v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- public v79 application commit: `e1cbe2eb1cb9d97295ecfc9836d0f9bac9cfc191`;
- PWA cache: `crypto-lab-v79-7930-auth1`;
- v79 publication over v78: not authorized.
