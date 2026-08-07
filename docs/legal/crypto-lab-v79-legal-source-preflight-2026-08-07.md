# CRYPTO LAB v79 — Legal source preflight

Date: 2026-08-07
Status: PRELAUNCH SOURCE ALIGNMENT ONLY — NOT FINAL LEGAL APPROVAL
Candidate: v79 build 7930

## Purpose

This preflight maps the unpublished CRYPTO LAB commercial legal drafts to current Ukrainian primary legislation before operator identity, governing law, served markets and final counsel review are supplied. It does not authorize publication, checkout, real payments, registration, refunds or production launch.

## Current primary-source baseline

1. Law of Ukraine No. 1023-XII "On Consumer Rights Protection"
   - Official source: https://zakon.rada.gov.ua/go/1023-12
   - Current status checked 2026-08-07: in force; current edition shown by Verkhovna Rada as 2024-12-24.
   - The official card indicates future loss of force under Law No. 3153-IX, not earlier than termination/cancellation of martial law.

2. Law of Ukraine No. 3153-IX "On Consumer Rights Protection"
   - Official source: https://zakon.rada.gov.ua/go/3153-20
   - Current status checked 2026-08-07: "nabyraye chynnosti" / future entry into force; it is not treated by this project as the current replacement for No. 1023-XII.

3. Law of Ukraine No. 3321-IX "On Digital Content and Digital Services"
   - Official source: https://zakon.rada.gov.ua/go/3321-20
   - Current status checked 2026-08-07: in force; entry into force 2024-03-02.
   - Relevant because CRYPTO LAB supplies access to a digital service and digital outputs/data functionality.

4. Law of Ukraine No. 675-VIII "On Electronic Commerce"
   - Official source: https://zakon.rada.gov.ua/go/675-19
   - Current status checked 2026-08-07: in force.
   - Relevant to electronic contracts, required transaction information, and stated payment methods/timing.

5. Law of Ukraine No. 2297-VI "On Personal Data Protection"
   - Official source: https://zakon.rada.gov.ua/go/2297-17
   - Current status checked 2026-08-07: in force; current edition shown by Verkhovna Rada as 2025-06-14.
   - Relevant to controller identity, purposes, data categories, rights, recipients and security of personal data.

## Draft alignment findings

### Terms of Use

Current draft already:
- describes CRYPTO LAB as a digital analytical service rather than an exchange/broker/asset manager;
- states BASIC USD 20/month and PRO USD 49/month as inactive prelaunch pricing;
- states that signals, market data, backtests and AI output do not guarantee profit;
- preserves mandatory consumer rights;
- keeps real on-chain payments disabled pending separate authorization.

Still required before publication:
- legal operator name and registration details;
- legal/complaint address and support contact;
- governing law and served-market review;
- actual payment/contract flow must record the legal document revisions accepted by the user;
- final counsel review against the operator's actual legal status and tax/payment model.

### Privacy Policy

Current draft already describes data categories, purposes, major provider categories, security controls, retention principle and user-right concepts.

Still required before publication:
- identify the actual data controller/operator and privacy contact;
- validate the final processor/recipient list against deployed production services;
- document actual retention periods where they can be specified rather than only purpose-based criteria;
- validate international-transfer mechanisms for the actual providers and served markets;
- record Privacy Notice acknowledgement separately from any consent that may be required for a distinct optional processing purpose.

### Refund Policy

Owner-approved Refund Policy v1 remains suitable as a conservative project policy for prelaunch preparation because it preserves mandatory rights and covers non-delivery/material non-conformity/duplicate or unauthorized payment cases.

Before publication/execution:
- counsel must validate refund/cancellation language against the final contract flow and current applicable law;
- support/claim contact must be supplied;
- refund execution remains technically disabled;
- the 14-day language remains explicitly conditional where that deadline is mandatory under applicable law, rather than being represented as a universal unconditional right for every completed digital-service period.

### Risk Disclosure

Current draft correctly avoids guarantees of profit and states market, data, model, execution and digital-asset risks. Before commercial publication, counsel should review whether the final product positioning or marketing creates any additional regulated-services implications in the actual served markets.

## Technical compliance gap closed during this preflight

A versioned legal-acknowledgement evidence register has been prepared in Supabase:
- table: `public.crypto_legal_acceptances`;
- service-only recorder: `private.crypto_record_legal_acceptance(...)`;
- Terms acceptance, Privacy Notice acknowledgement, Refund Policy acknowledgement and Risk Disclosure acknowledgement are versioned separately;
- raw secret-like material is rejected from evidence;
- anon/authenticated direct table/function access is denied;
- registration/checkout/payment activation remains OFF;
- current row count is zero because no real Auth users exist.

Migration: `20260807072731_prepare_versioned_legal_acceptance_evidence`.

## Launch boundary

Legal source alignment: PREPARED.
Final legal approval: NOT COMPLETE.
Operator disclosures: MISSING.
Publication authorization: FALSE.
Real payments: DISABLED.
Public registration: DISABLED.
Refund execution: DISABLED.

No commercial launch should be authorized from this preflight alone.
