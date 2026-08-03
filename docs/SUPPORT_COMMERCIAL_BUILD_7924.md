# CRYPTO LAB v79 — Support and commercial consent

Build: `7924`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 application was not modified.

## Authenticated support center

New user module: `v79/support.html`.

Authenticated users can:

- create bounded support tickets in account, billing, technical, signals or other categories;
- view their own conversation history;
- reply to non-closed tickets;
- reopen a resolved ticket by replying;
- use RU, UA or EN interface text.

Server controls:

- maximum five open or in-progress tickets per user;
- maximum two new tickets in ten minutes;
- maximum five user replies per minute;
- subject length 3–120 characters;
- message length up to 4,000 characters;
- direct table access denied; bounded RPCs enforce ownership and limits.

Admin module: `v79/admin-support.js`.

Administrators can review the queue, change status and priority, assign the ticket to themselves and send a bounded reply. Admin access is checked inside each server function.

The Support route and PWA shortcut are connected to the v79 terminal. `support.html`, `support-extension.js` and `admin-support.js` are included in the offline shell.

## Versioned legal consent

Tables:

- `crypto_legal_documents` — active version, effective date and local legal-page path for Terms, Privacy and Risk Disclosure;
- `crypto_legal_acceptances` — per-user accepted version, locale, source, timestamp and privacy-preserving request hashes.

Active legal version: `2026-08-03` for all three documents.

Direct client writes to legal acceptance records are denied. Acceptances are recorded through service-role-only workflows.

## Protected registration consent

`crypto-lab-v79-register` version 2 now:

- returns all active legal-document versions in its configuration response;
- refuses registration unless every current document version is explicitly accepted;
- records Terms, Privacy and Risk acceptances after the Auth user is created;
- deletes the new Auth user if legal-acceptance persistence fails;
- continues to send confirmation only through CRYPTO LAB → Lumeria → Resend;
- remains disabled until Turnstile keys and `CRYPTO_PUBLIC_REGISTRATION_ENABLED=true` are configured.

Client module `registration-consent.js` displays the current legal links and adds the exact accepted versions to the protected registration request. It cannot bypass the server-side version comparison.

## Commercial access foundation

Protected Edge Function: `crypto-lab-v79-commercial`.

Controls:

- mandatory valid Supabase JWT;
- origin restricted to `https://1specnazov1.github.io`;
- server-side Auth user verification;
- legal acceptance stored through service-role-only RPC;
- paid-plan requests rejected until all current legal versions are accepted;
- existing pending request is updated rather than duplicated;
- a pending request can be cancelled by its owner;
- no payment is created and no money is charged.

Client module `commercial.js` shows:

- current legal documents and accepted versions;
- explicit acceptance controls;
- BASIC and PRO configuration state;
- pending plan request state;
- request notes and cancellation controls.

Prices and payment provider remain intentionally unconfigured. The user interface clearly states that a plan request does not charge money.

## Build and PWA

Build `7924` adds to the offline shell:

- `support-extension.js`;
- `commercial-extension.js`;
- `support.html`;
- `admin-support.js`;
- `registration-consent.js`;
- `commercial.js`.

The manifest includes a Support shortcut. The entry point redirects to `app.html?v=7924`.

## Verification

- registration configuration returned HTTP 200, `enabled=false` and the three active legal documents;
- disabled registration POST returned HTTP 503 before creating a rate-limit row or user;
- unauthenticated commercial endpoint returned HTTP 401;
- registration attempts, legal acceptances, support tickets and plan requests remained at zero;
- no email was sent and no external account was created;
- the deployed GitHub Pages build returned HTTP 200 for all new files;
- all external JavaScript and inline support JavaScript passed syntax validation;
- manifest JSON and Support shortcut were validated;
- the temporary public validator was restored to mandatory JWT.

## Remaining launch blockers

- Cloudflare Turnstile site key and secret key;
- explicit registration and recovery activation flags;
- BASIC and PRO prices;
- payment provider credentials and verified webhook configuration;
- operator identity, legal address, support SLA, refund rules and deletion-processing period.

Supabase Security Advisor warnings for authenticated `SECURITY DEFINER` RPCs are expected for the bounded support and account workflows. Every warned function has a fixed search path and performs an internal authentication, ownership or admin-role check. They should be reviewed again before commercial activation. Unused-index notices concern empty pre-launch tables and the indexes are retained for expected production queries.
