# CRYPTO LAB — Commercial Readiness Block 1

Date: 2026-08-06
Scope: testnet payment contour only. No mainnet activation, real payment, subscription entitlement, registration, refund, or v79-over-v78 publication.

## Live RPC observations

Final probe time: 2026-08-06 17:00:15–17:00:16 UTC.

Ethereum Sepolia sender:
- Address: `0x4eadfbe9665265527e9a5d6bde6fb15a70f05555`
- RPC: `https://ethereum-sepolia-rpc.publicnode.com`
- Observed chain ID: `0xaa36a7` / `11155111`
- Native ETH balance: `0`
- Circle test USDC balance: `0`
- Probe request IDs: `18330`, `18331`, `18332`

Solana Devnet sender:
- Address: `4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4`
- RPC: `https://api.devnet.solana.com`
- Confirmed slot observed: `481666787`
- Native SOL balance: `0`
- Circle test USDC token accounts: `0`
- Probe request IDs: `18333`, `18334`

## Exact owner-signed transfer templates

Ethereum Sepolia:
- Asset: Circle test USDC
- Token / transaction `to`: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Recipient: `0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9`
- Amount: `0.01 USDC` / `10000` base units
- Method: `transfer(address,uint256)` / selector `0xa9059cbb`
- Transaction value: `0 wei`
- Calldata: `0xa9059cbb000000000000000000000000bcd27864ea603643bc8aebb3fe2cec2ffdb39eb90000000000000000000000000000000000000000000000000000000000002710`
- Gas and nonce: estimated by the owner wallet at signing time
- Broadcast flag in stored template: `false`

Solana Devnet:
- Asset: Circle test USDC
- Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Recipient owner: `EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F`
- Amount: `0.01 USDC` / `10000` base units / 6 decimals
- Instruction: `transfer_checked`
- Sender and recipient ATAs: derived from owner + Token Program + mint
- Recipient ATA: create idempotently in the same transaction if absent
- Recent blockhash and fee estimate: obtained from official Devnet RPC at signing time
- Fee payer and signer: owner wallet
- Broadcast flag in stored template: `false`

## Verifier result

Supabase migrations:
- `20260806160423_complete_testnet_payment_contour_fixture_v1`
- `20260806170016_finalize_testnet_payment_contour_live_probe_v1`

The isolated `sandbox-fixture-v1` validator passed for both Ethereum and Solana. It checks:
- network;
- sandbox chain reference;
- recipient;
- token identifier;
- exact amount;
- successful execution;
- required finalized state.

Negative fixture matrix also passed: wrong amount, wrong recipient, wrong network, and non-final status were rejected.

Recorded fixture evidence hashes:
- Ethereum: `b284ef72a695ebd2010e95810a0a423da152c13210d6e31cdee53ff7a4d8f72a`
- Solana: `01e5ef4c92b613ec227dbbb64c6bb4424dfd572efd191b9d2c2ef4e92fffb447`

The final live probe created two additional `rpc_observed` evidence rows with `FUNDING_REQUIRED`; no transaction hash was created because nothing was signed or broadcast.

## Funding routes and blockers

Official references verified on 2026-08-06:
- Circle test USDC faucet: `https://faucet.circle.com/`
- Circle testnet addresses: `https://developers.circle.com/stablecoins/usdc-contract-addresses`
- Circle Solana transfer guide: `https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana`
- Ethereum Sepolia chain ID reference: `https://ethereum.org/developers/tutorials/creating-a-wagmi-ui-for-your-contract/`
- Solana payment address verification: `https://solana.com/docs/payments/send-payments/verify-address`
- Solana Devnet faucet: `https://faucet.solana.com/`

Current blockers:
- Ethereum sender needs Sepolia ETH and Circle test USDC.
- Solana sender needs Devnet SOL and Circle test USDC.
- Solana Web Faucet rejected the new GitHub account by account-age policy.
- Official Solana RPC `requestAirdrop` returned `Internal error`; no rate-limit bypass was attempted.
- Circle faucet requires human reCAPTCHA.
- Final transfers require owner wallet signatures; no seed phrase or private key is required or stored.

## Safety boundary after work

- Active production networks: `0`
- Active prices: `0`
- Production invoices: `0`
- Transaction claims: `0`
- Production observations: `0`
- Active receiving addresses: `0`
- Test transfers executed: `0`

Conclusion: RPC connectivity, official token identifiers, exact transfer templates, positive verifier fixtures, and negative rejection fixtures are ready. The block remains externally blocked only by testnet funding and owner wallet signatures.
