# CRYPTO LAB v79 — On-chain Owner Decision Provenance

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed owner decision

The user explicitly wrote:

> Три сети утверждаю.

The exact UTF-8 SHA-256 fingerprint is:

`57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be`

This approves the following network set for future CRYPTO LAB wallet payments:

- TRON / TRC20;
- BNB Smart Chain / BEP20;
- Solana / SPL.

The decision approves the network set only. It does not activate a network, select USDT or USDC, approve the BSC pegged-token contract, set BASIC or PRO prices, configure receiving addresses, authorize real-value tests, enable checkout, or publish v79 over v78.

## Provenance incident

Several autonomous migrations alternated between two incorrect interpretations:

1. recording a fabricated original message timestamp;
2. claiming the user had never approved the three networks.

The original message timestamp was not available to the database migration and therefore is explicitly recorded as unknown. The exact text and its hash—not an inferred timestamp—are the authoritative evidence.

The conflicting candidate-only migrations are retained in immutable migration history for auditability but are superseded by the final authoritative migration:

`20260805093151_enforce_recorded_owner_three_network_decision`

Source:

`supabase/migrations/20260805093151_enforce_recorded_owner_three_network_decision.sql`

Source commit:

`9c0a335a1ad0817857f183c99c3a39ee491f62d0`

## Authoritative database controls

The final migration binds the approved network state to an immutable row in `public.crypto_owner_decision_records`:

- decision code: `ONCHAIN_THREE_NETWORK_SELECTION`;
- exact text: `Три сети утверждаю.`;
- exact hash: `57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be`;
- source: `owner_chat`;
- original message timestamp known: `false`;
- activation authorized: `false`.

The active trigger guards require that exact record and hash. They block:

- fabricated approval without the immutable record;
- changing the approved network set;
- silently removing an approved network;
- returning `PAYMENT_PROVIDER` to `decision_required` without a new explicit owner revocation decision;
- treating network selection as authorization for live activation.

The decision record itself is immutable. Direct browser access is denied and RLS is enabled.

## Verified safe state

- TRON, BSC and Solana: `approved_by_owner=true`, `status=inactive`;
- selected settlement asset: none;
- active prices: zero;
- receiving addresses: zero;
- invoices: zero;
- chain observations: zero;
- provider mode: disabled;
- lifecycle status: draft;
- checkout: disabled;
- webhook: disabled;
- recurring debit: disabled;
- refunds: disabled;
- users and Auth attempts: zero;
- automatic entitlement: inactive;
- v78 unchanged.

Integrity snapshots after the final migration:

- owner-decision integrity: 5/5 healthy;
- on-chain integrity: 11/11 healthy;
- data integrity: 45/45 healthy;
- launch-control integrity: 6/6 healthy.

## Remaining decisions and external inputs

Payment activation remains blocked until these are independently decided, configured and verified:

- USDT or USDC;
- separate acceptance of the BSC pegged-USDT contract if USDT is selected;
- BASIC and PRO pricing;
- one public receiving address for each approved network;
- RPC/indexer configuration;
- WalletConnect project ID;
- controlled sandbox evidence;
- explicit payment activation approval.

Seed phrases, private keys and wallet passwords are never required.
