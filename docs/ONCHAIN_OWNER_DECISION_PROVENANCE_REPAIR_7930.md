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

## Confirmed concurrency defect

Overlapping autonomous runs applied mutually contradictory migrations and GitHub evidence. Some runs correctly recorded the explicit owner decision; other runs used stale context and restored a false `candidate-only` interpretation.

No real payment, user registration, email, wallet transfer or entitlement was created during the incident. The recurring autonomous cycle was paused to stop further state oscillation before the canonical repair was applied.

## Canonical repair

The authoritative Supabase migration is:

`20260805094628_restore_canonical_owner_three_network_authority`

Source:

`supabase/migrations/20260805094628_restore_canonical_owner_three_network_authority.sql`

Source commit:

`2b5ff1105c9e1ff65f7d192e08a368b0bb31cede`

The final migration:

- restores one active immutable decision record with the exact text and hash;
- sets TRON, BSC and Solana to `approved_by_owner=true` and `status=inactive`;
- installs validated CHECK constraints preventing those networks from becoming unapproved;
- prevents `PAYMENT_PROVIDER` from returning to `decision_required` while the canonical decision exists;
- prevents update, deletion or archival of the decision record;
- keeps activation, checkout, webhook, recurring debit and refunds disabled;
- preserves all conflicting migrations only as historical audit trail.

The exact decision text and its hash—not an inferred timestamp—are the source of truth. The original message timestamp is explicitly recorded as unknown.

## Verified safe state

- TRON, BSC and Solana: owner-approved, technically inactive;
- selected settlement asset: none;
- active prices: zero;
- receiving addresses: zero;
- invoices: zero;
- chain observations and transaction claims: zero;
- provider mode: disabled;
- lifecycle status: draft;
- checkout: disabled;
- webhook: disabled;
- recurring debit: disabled;
- refunds: disabled;
- Auth users, profiles, registration attempts and recovery attempts: zero;
- automatic entitlement: prepared but inactive;
- v78 unchanged.

Integrity snapshots after the canonical migration:

- owner-decision integrity: 6/6 healthy;
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
