# CRYPTO LAB v79 — On-chain Owner Decision Provenance

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Verified owner decision

The owner explicitly wrote:

> Три сети утверждаю.

The approved network set is:

- TRON / TRC20;
- BNB Smart Chain / BEP20;
- Solana / SPL.

This decision approves the network set only. It does not activate any network, choose USDT or USDC, approve prices, configure receiving addresses, authorize real-money testing, or publish v79 over v78.

## Provenance incident and repair

An earlier autonomous correction incorrectly stated that no network-selection decision existed. That statement was false because it did not include the immediately preceding owner message in its evidence scope.

The unsafe part of the earlier record was not the network choice itself, but a fabricated exact decision timestamp. The exact original message timestamp was not available to the database migration and must not be invented.

Migration `20260805092421_record_explicit_owner_three_network_decision` records the decision correctly:

- exact decision text: `Три сети утверждаю.`;
- source channel: `owner_chat`;
- decision code: `ONCHAIN_THREE_NETWORK_SELECTION`;
- SHA-256 decision fingerprint: `57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be`;
- original message timestamp known: `false`;
- recording timestamp: database-generated at migration execution;
- payment/network activation authorized: `false`.

The immutable source is stored in `crypto_owner_decision_records`. Direct access by `PUBLIC`, `anon` and `authenticated` is denied, RLS is enabled, and update/delete operations are blocked by an immutable-record trigger.

## Permanent provenance guards

Migration `20260805091915_guard_onchain_owner_decision_provenance` remains useful and is retained.

1. `crypto_onchain_network_owner_approval_guard` rejects a transition to `approved_by_owner=true` unless the protected transaction sets `app.crypto_owner_decision_authorized=true`.
2. `crypto_payment_owner_decision_provenance_guard` rejects launch-control records claiming owner approval unless the same protected transaction authorization is present.

Migration `20260805092421_record_explicit_owner_three_network_decision` uses that protected path and binds the exact decision text and hash to the three approved but inactive networks.

## Current safe state

- TRON, BSC and Solana: owner-approved, technically inactive;
- provider mode: disabled;
- checkout: disabled;
- webhook: disabled;
- recurring debit: disabled;
- refunds: disabled;
- selected settlement asset: none;
- active prices: zero;
- receiving addresses: zero;
- invoices: zero;
- blockchain observations: zero;
- automatic entitlement: inactive;
- v78 remains unchanged.

## Remaining owner/external inputs

Activation remains blocked until the following are independently completed and verified:

- USDT or USDC decision;
- BSC pegged-USDT acceptance if USDT is selected;
- BASIC and PRO price policy;
- public receiving address for each approved network;
- RPC/indexer and WalletConnect configuration;
- controlled sandbox evidence;
- explicit payment activation approval.
