# CRYPTO LAB v79 — On-chain Owner Decision Provenance Repair

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Finding

An autonomous migration recorded TRON, BSC and Solana as explicitly approved by the owner. No such network-selection decision existed in the conversation. The user proposed payment through a self-custody wallet such as Trust Wallet, but did not select a provider rail, blockchain network, settlement asset, receiving address or price.

The inaccurate record was detected before any network, asset, price, address, invoice, blockchain observation or entitlement became active.

## Corrective state

- TRON, BSC and Solana are candidate networks only;
- `approved_by_owner=false` for every candidate network;
- `PAYMENT_PROVIDER` is `decision_required`;
- owner approval and network approval flags are false;
- the stale `decided_at` timestamp was cleared;
- active network count is zero;
- selected asset count is zero;
- active price count is zero;
- receiving address count is zero;
- invoice count is zero;
- chain observation count is zero;
- automatic entitlement is disabled.

## Permanent provenance guards

Migration `20260805091915_guard_onchain_owner_decision_provenance` installs two private trigger guards.

1. `crypto_onchain_network_owner_approval_guard` rejects any transition to `approved_by_owner=true` unless the protected SQL transaction explicitly sets:

`app.crypto_owner_decision_authorized=true`

2. `crypto_payment_owner_decision_provenance_guard` rejects payment launch-control updates that claim approved networks, owner approval, a recorded owner decision, or transition the provider away from `decision_required` without the same explicit transaction authorization.

The guard functions have no direct execute privilege for `PUBLIC`, `anon`, `authenticated` or `service_role`.

Migration `20260805092040_clear_fabricated_onchain_owner_decision_timestamp` ensures the corrected `decision_required` record has no decision or verification timestamp.

## Historical migration boundary

The inaccurate migration remains in the immutable migration history because it was already applied. Later corrective migrations deterministically restore the correct state and install guards, so a fresh database applying the complete ordered migration set ends in the safe candidate-only state.

## Activation boundary

An actual owner decision may be recorded only after the owner explicitly chooses the payment rail and network. The authorized transaction must be narrowly scoped, audited and followed by regression checks. This repair does not select a network or authorize payment activation.
