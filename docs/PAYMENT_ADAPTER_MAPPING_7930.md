# CRYPTO LAB v79 — Provider-Neutral Payment Adapter Mapping

Date: 2026-08-05  
Build: 7930  
Provider: unselected  
Checkout and real-money operation: disabled

## 1. Purpose

This document maps LiqPay, Stripe and a direct on-chain WalletConnect payment option into one server-controlled CRYPTO LAB billing state machine. It does not select a provider, activate prices, install credentials, connect a receiving wallet or allow real-money testing.

## 2. Trust Wallet's role

Trust Wallet is a self-custody wallet client. It can connect to a web application through WalletConnect, open deep links and ask the user to approve a transaction. It is not the CRYPTO LAB merchant processor and it does not provide the server-side source of truth for access activation.

For direct crypto payment, the source of truth is a blockchain transaction independently verified by the CRYPTO LAB backend. A connected wallet address, a signed message, a browser callback, a screenshot or a user-supplied transaction hash must never activate a plan by itself.

CRYPTO LAB must never request a seed phrase, private key, wallet password or custody of the user's wallet.

## 3. Candidate adapters

### LiqPay

Candidate for hosted UAH checkout. Access changes only after a signed server callback is normalized, persisted and reconciled. Recurring billing and provider refunds remain candidates, not active capabilities.

### Stripe

Candidate for a future eligible legal entity. Access changes only after a signed webhook is normalized, persisted and reconciled. No eligibility or merchant account is assumed.

### Direct on-chain payment

Candidate flow:

1. Authenticated user selects a plan.
2. Server creates a unique invoice with order ID, network, asset, official token contract or native-asset marker, receiving address, exact atomic amount, expiry and required confirmations.
3. The browser may present WalletConnect, a Trust Wallet deep link or a QR representation.
4. The user approves the transaction in the wallet.
5. The backend observes the selected blockchain through an approved RPC/indexer and verifies transaction success, network, contract, recipient, amount, uniqueness, block time and confirmation/finality policy.
6. A normalized `payment.succeeded` event is written idempotently.
7. Only the server changes the subscription and grants BASIC or PRO access.

The launch candidate is prepaid access for 30 days. Direct wallet transfers do not provide automatic renewal. A new user-approved payment is required for each extension unless a separately audited smart-contract recurring protocol is approved later.

## 4. Important schema gap found

The current runtime normalized billing schema v1 cannot safely represent direct on-chain payment:

- its provider enum does not include `onchain`;
- its currency field accepts exactly three letters, while common token symbols may be longer;
- it has no network, contract, transaction hash, confirmation or chain-finality fields;
- current database constraints have not been migrated for these fields.

Therefore direct crypto payment is explicitly blocked. A non-production v2 draft schema has been added for review. It is not consumed by runtime code and does not authorize a database migration.

## 5. On-chain safeguards

A future implementation must enforce:

- explicit network and asset allowlists;
- official token-contract allowlist;
- one configured receiving address per approved network or a documented address-allocation strategy;
- integer atomic amounts rather than floating-point token values;
- invoice expiry and price-lock policy;
- unique transaction hash and unique normalized provider event;
- minimum confirmations plus reorganization/finality policy;
- no entitlement for wrong network, wrong token, wrong recipient or insufficient amount;
- defined handling for overpayment and late payment;
- RPC/indexer disagreement quarantine;
- server-side reconciliation independent of the browser session;
- no hot-wallet private key in the web application.

A merchant receiving address is public configuration, not a signing credential. Outbound refunds are a separate high-risk operation and require an audited administrator decision and independently confirmed outbound transaction. Automatic refund execution is forbidden at launch.

## 6. WalletConnect and Trust Wallet controls

A WalletConnect project ID is a public identifier but must be limited to the exact application origin in the WalletConnect dashboard. An empty origin allowlist is forbidden for production. The project ID cannot be treated as proof of payment.

Trust Wallet may be opened through WalletConnect or an approved deep link. The transaction request must display the actual chain, asset, recipient and amount for user approval. The backend must still re-derive expected invoice data and verify the finalized transaction.

## 7. Mapping to the fourteen sandbox scenarios

The existing payment sandbox matrix remains authoritative. For on-chain payment:

- checkout success becomes a finalized matching transaction;
- user abandonment becomes invoice expiry without a matching transaction;
- duplicate webhook becomes duplicate chain observation with one event and one entitlement change;
- out-of-order events become pending/confirming/final observations reconciled without state regression;
- redirect failure cannot prevent a later finalized transaction from activating access;
- renewal is a new prepaid invoice, not an automatic wallet debit;
- full and partial refunds require verified outbound transactions and audit evidence;
- unknown networks, assets or malformed observations are quarantined.

All fourteen scenarios must pass before an adapter can be verified.

## 8. Required owner and external decisions

Direct crypto payment requires explicit decisions for:

- provider rail: fiat processor, direct on-chain, or both;
- network;
- asset and official contract;
- public receiving address;
- BASIC and PRO price policy;
- price-lock duration and under/overpayment tolerance;
- confirmation/finality policy;
- refund custody and approval process;
- WalletConnect project creation and origin allowlist;
- RPC/indexer service and credentials, if applicable.

No seed phrase or private key should ever be supplied to CRYPTO LAB or stored in GitHub/Supabase application configuration.

## 9. Official references

- Trust Wallet web3 integration: https://developer.trustwallet.com/developer/develop-for-trust
- Trust Wallet mobile WalletConnect: https://developer.trustwallet.com/developer/develop-for-trust/mobile
- Trust Wallet deep links: https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
- WalletConnect App SDK and origin allowlist: https://docs.walletconnect.network/app-sdk/javascript/installation
- ERC-681 transaction request URL format: https://eips.ethereum.org/EIPS/eip-681
