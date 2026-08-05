# CRYPTO LAB v79 — On-chain Owner Decision Provenance Repair

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed conversation fact

The user proposed exploring payment through a crypto wallet such as Trust Wallet. The user did **not** write `Три сети утверждаю.` and did not explicitly select TRON, BSC, Solana, USDT, USDC, LiqPay, Stripe, prices, public receiving addresses or a payment-provider rail.

TRON, BSC and Solana are candidate networks only.

## Provenance incident

Several autonomous migrations and two GitHub Actions workflows incorrectly reconstructed an owner decision. They created an exact sentence, SHA-256 fingerprint and `owner_chat` provenance that did not exist in the user's messages.

The inaccurate state was detected before any network, asset, price, receiving address, invoice, blockchain observation, entitlement or real-value transfer became active.

The two self-rewriting workflows that restored the false decision were removed:

- `v79-owner-network-decision-sync-once.yml`;
- `v79-owner-network-decision-validation.yml`.

Stale one-shot on-chain manifest synchronizers were also removed after their evidence was superseded.

## Current corrective state

- TRON, BSC and Solana remain `inactive` and `approved_by_owner=false`;
- `PAYMENT_PROVIDER` remains `decision_required`;
- `decided_at` and `verified_at` are null;
- owner/provider approval flags are false;
- selected asset, active price, configured receiving address, invoice, chain observation and credited claim counts are zero;
- automatic entitlement and automatic wallet debit are disabled;
- checkout, webhook, recurring billing and refunds remain disabled.

## Historical audit record

The invalid reconstructed record is retained only for audit because a supersession row references it. It is explicitly `active=false` and excluded from launch state.

The supersession class is `invalid_reconstructed_owner_decision`; activation is not authorized.

## Fail-closed database controls

Authoritative migration sequence:

- `20260805093547_add_owner_decision_supersession_audit`;
- `20260805093613_restore_onchain_candidate_only_state`;
- `20260805093641_install_fail_closed_payment_owner_decision_guards`;
- `20260805093754_enforce_fail_closed_owner_decision_constraints`;
- `20260805094250_archive_and_block_payment_owner_decision_records`.

The active state is fail-closed at three levels:

1. trigger guards reject `approved_by_owner=true`, owner/approval/decision/activation metadata, provider state transitions and owner-approval claims;
2. validated `CHECK` constraints enforce candidate-only networks and require `PAYMENT_PROVIDER=decision_required` with null decision timestamps;
3. the owner-decision table permits historical ONCHAIN/PAYMENT records only when `active=false`, blocks new payment/on-chain decision inserts, and revokes service-role DML.

Actual negative probes verified that unauthorized network approval, approval metadata and provider-owner claims are rejected.

There is deliberately no autonomous bypass. A real owner decision requires a future, narrowly scoped manual migration after a new user message explicitly selects the provider rail and network set.

## Immutable migration history

Inaccurate migrations remain in applied history for auditability, but are superseded by the authoritative controls above. A fresh database applying the full ordered migration set ends in the safe candidate-only state.

## Activation boundary

This repair does not choose a provider, network or token. Payment activation remains blocked until the user explicitly selects the provider rail, networks, settlement asset, prices and receiving addresses, and all sandbox/finality/security prerequisites pass.

Seed phrases, private keys and wallet passwords are never required.
