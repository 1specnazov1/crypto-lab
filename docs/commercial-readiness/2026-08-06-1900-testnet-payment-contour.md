# CRYPTO LAB — Commercial Readiness Block 1

Date: 2026-08-06
Scope: testnet payment contour only. No mainnet activation, real payment, subscription entitlement, registration, refund, or v79-over-v78 publication.

## Live RPC observations

Ethereum Sepolia sender:
- Address: `0x4eadfbe9665265527e9a5d6bde6fb15a70f05555`
- RPC: `https://ethereum-sepolia-rpc.publicnode.com`
- Observed chain ID: `0xaa36a7` / `11155111`
- Native ETH balance: `0`
- Circle test USDC balance: `0`
- Probe request IDs: `18191`, `18192`, `18193`

Solana Devnet sender:
- Address: `4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4`
- RPC: `https://api.devnet.solana.com`
- Confirmed slot observed: `481656968`
- Native SOL balance: `0`
- Circle test USDC token accounts: `0`
- Probe request IDs: `18194`, `18195`

## Exact owner-signed transfer templates

Ethereum Sepolia:
- Asset: Circle test USDC
- Token: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Recipient: `0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9`
- Amount: `0.01 USDC` / `10000` base units
- Action: ERC-20 transfer signed only in the owner's external wallet

Solana Devnet:
- Asset: Circle test USDC
- Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Recipient owner: `EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F`
- Amount: `0.01 USDC` / `10000` base units
- Action: SPL transfer signed only in the owner's external wallet; recipient ATA may need creation

## Verifier result

Supabase migration: `20260806160423_complete_testnet_payment_contour_fixture_v1`

The isolated `sandbox-fixture-v1` validator passed for both Ethereum and Solana. It checks:
- network;
- sandbox chain reference;
- recipient;
- token identifier;
- exact amount;
- successful execution;
- required finalized state.

Negative fixture matrix also passed: wrong amount, wrong recipient, wrong network, and non-final status were rejected.

Recorded immutable evidence hashes:
- Ethereum: `b284ef72a695ebd2010e95810a0a423da152c13210d6e31cdee53ff7a4d8f72a`
- Solana: `01e5ef4c92b613ec227dbbb64c6bb4424dfd572efd191b9d2c2ef4e92fffb447`

## Funding routes and blockers

Official references verified on 2026-08-06:
- Circle test USDC faucet: `https://faucet.circle.com/`
- Circle testnet addresses: `https://developers.circle.com/stablecoins/usdc-contract-addresses`
- Ethereum Sepolia faucet directory: `https://ethereum.org/developers/docs/networks/`
- Solana Devnet faucet: `https://faucet.solana.com/`

Current blockers:
- Ethereum sender needs Sepolia ETH and Circle test USDC.
- Solana sender needs Devnet SOL and Circle test USDC.
- Solana Web Faucet rejected the new GitHub account by account-age policy.
- Official Solana RPC `requestAirdrop` returned `Internal error`; no rate-limit bypass was attempted.
- Final transfers require owner wallet signatures; no seed phrase or private key is required or stored.

## Safety boundary after work

- Active production networks: `0`
- Active prices: `0`
- Production invoices: `0`
- Transaction claims: `0`
- Production observations: `0`
- Active receiving addresses: `0`
- Test transfers executed: `0`

Conclusion: RPC connectivity, exact transfer templates, and recognition logic are ready. The block remains externally blocked only by testnet funding and owner wallet signatures.