# CRYPTO LAB v79 — Three-network on-chain payment foundation

Date: 2026-08-05  
Build: 7930  
Activation: disabled

## Owner decision recorded

The payment interface will offer three networks:

1. TRON / TRC20;
2. BNB Smart Chain / BEP20;
3. Solana / SPL.

Trust Wallet, WalletConnect, QR and compatible wallets are payment-signing interfaces. A wallet confirmation, screenshot or browser callback is not proof of payment. CRYPTO LAB grants access only after independent verification of the final blockchain state.

## Implemented database contour

Eight protected tables were added:

- network registry;
- asset registry;
- network/token registry;
- receiving-address registry;
- plan pricing;
- bounded FX quotes;
- on-chain invoices;
- immutable transaction observations.

All tables use RLS. Anonymous and authenticated roles have explicit restrictive deny policies and no direct table privileges. Invoice creation and chain-observation ingestion are service-only operations.

## Invoice model

Each invoice contains:

- authenticated user and selected plan;
- exact network and token identifier;
- verified receiving address;
- accounting amount and settlement amount;
- bounded expiry;
- a unique fractional discriminator of no more than 999 token base units;
- optional transaction hash binding;
- finality and observation evidence.

The discriminator permits reliable matching of QR/deep-link payments sent to a shared address without changing the commercial price materially. With a six-decimal stablecoin the maximum discriminator is 0.000999 token.

## Chain finality

- TRON requires the transaction to be solidified; the configured policy uses 19 confirmations.
- BSC requires the finalized chain state; the configured policy uses a two-block finality threshold.
- Solana requires finalized commitment.

No entitlement is created for an unconfirmed, confirmed-but-not-final, reverted or failed transaction.

## Automatic entitlement

An exact final payment generates one normalized `payment.succeeded` event through the existing billing state machine. That event activates BASIC or PRO for 30 days. A transaction hash can be claimed only once per network. Repeated observation is idempotent and cannot create duplicate access.

The contour explicitly handles:

- wrong network;
- wrong token contract;
- wrong recipient;
- underpayment;
- overpayment;
- unfinalized state;
- failed transaction;
- duplicate transaction hash;
- late payment after invoice expiry;
- verifier outage;
- refund and dispute review.

Automatic recurring debit is not enabled. A user confirms every new 30-day purchase in their wallet.

## Asset decision constraint

The official issuer registries currently produce this matrix:

- USD₮: direct issuer contracts verified for TRON and Solana;
- USD₮ on BSC: a pegged-token contract and explicit owner acceptance are still required;
- USDC: direct issuer contract verified on Solana, but Circle's official mainnet list does not include TRON or BSC.

Therefore USDC cannot provide one official issuer asset across all three approved networks. The practical three-network option is USDT plus a separately verified and explicitly accepted BSC pegged-token contract. No BSC token contract has been activated or guessed.

## Disabled-state proof

- networks approved but inactive: 3;
- selected settlement assets: 0;
- receiving addresses: 0;
- pricing rows: 0;
- invoices: 0;
- transaction observations: 0;
- browser-executable public SECURITY DEFINER functions: 0;
- on-chain tables without RLS: 0;
- temporary Auth users after rollback tests: 0.

## Remaining decisions

1. Choose USDT or USDC. Recommendation: USDT if all three networks must remain.
2. If USDT is selected, accept or reject a verified BSC pegged-USDT token.
3. Choose pricing:
   - fixed USDT amounts; or
   - fixed UAH commercial prices converted into USDT when an invoice is created.
4. Approve BASIC and PRO amounts.
5. Provide three public receiving addresses: TRON, BSC and Solana.

Only public addresses are required. Seed phrases and private keys must never be provided to CRYPTO LAB, Supabase, GitHub or the assistant.

## Evidence

- migrations: `20260805085503`, `20260805085615`, `20260805085735`, `20260805085807`;
- initial on-chain contract gate: `30991833690`, success;
- extended sandbox matrix: 24 mandatory scenarios;
- stable root v78 SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
