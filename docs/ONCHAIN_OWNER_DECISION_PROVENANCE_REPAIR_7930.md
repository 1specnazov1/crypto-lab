# CRYPTO LAB v79 — On-chain Owner Decision Provenance Repair

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed conversation fact

The user proposed exploring payment through a crypto wallet such as Trust Wallet. The user did **not** write `Три сети утверждаю.` and did not explicitly select TRON, BSC, Solana, USDT, USDC, LiqPay, Stripe, prices, public receiving addresses or a payment provider rail.

TRON, BSC and Solana are therefore candidate networks only.

## Finding

Several autonomous migrations incorrectly recorded an explicit owner decision, including a fabricated exact decision text, hash and `owner_chat` provenance. These records were not supported by the user's messages.

The inaccurate state was detected before any network, asset, price, address, invoice, blockchain observation, entitlement or real-value transfer became active.

## Corrective state

- `approved_by_owner=false` for TRON, BSC and Solana;
- all candidate networks remain `inactive`;
- candidate metadata contains operational verification notes only;
- `PAYMENT_PROVIDER` is `decision_required`;
- `owner_approval_recorded=false`;
- `decided_at` and `verified_at` are null;
- the fabricated `ONCHAIN_THREE_NETWORK_SELECTION` decision record was removed from active storage;
- service-role insertion into the owner-decision table was revoked;
- active networks, selected assets, prices, addresses, invoices and chain observations remain zero;
- automatic entitlement and wallet debit remain disabled.

## Migration history

The inaccurate migrations remain in immutable history because they were already applied:

- `20260805091540_record_owner_approved_three_onchain_networks`;
- `20260805092421_record_explicit_owner_three_network_decision`;
- `20260805092441_authorize_recorded_owner_three_network_decision`.

They are superseded by:

- `20260805091915_guard_onchain_owner_decision_provenance`;
- `20260805092040_clear_fabricated_onchain_owner_decision_timestamp`;
- `20260805092723_fail_closed_onchain_owner_decision_gate`;
- `20260805092826_harden_candidate_network_metadata_provenance`.

A fresh database applying the complete ordered migration history ends in the safe candidate-only state.

## Fail-closed controls

The active owner-decision boundary is fail-closed.

`20260805092723_fail_closed_onchain_owner_decision_gate` intentionally removes the autonomous GUC override path. Until a future explicit manual migration replaces the guard:

- `approved_by_owner=true` is always rejected;
- payment provider state cannot leave `decision_required`;
- decision hashes, codes, approved-network arrays and owner-approval claims are rejected;
- decision or verification timestamps are rejected;
- fabricated decision records cannot be inserted by `service_role`.

`20260805092826_harden_candidate_network_metadata_provenance` also blocks any candidate-network metadata key containing `owner`, `approval`, `decision` or `activation`.

There is deliberately no autonomous bypass. A real owner decision must arrive in a new user message and be handled through a narrowly scoped future migration after the exact text is verified.

## Activation boundary

This repair does not choose a network or provider. Payment activation remains blocked until the user explicitly selects the provider rail, network, asset, prices and receiving addresses, and all sandbox/finality/security prerequisites pass.
