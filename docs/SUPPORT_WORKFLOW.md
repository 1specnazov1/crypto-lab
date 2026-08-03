# CRYPTO LAB v79 — Authenticated support workflow

Build: `7923`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated v79 GitHub Pages application. The working v78 application was not modified.

## User support center

New route and page:

- terminal route: `support`;
- page: `v79/support.html`;
- integration: `v79/support-extension.js`.

Authenticated users can:

- create a support ticket;
- choose Account, Billing, Technical, Signals or Other;
- view their own conversation history;
- reply to an open or resolved ticket;
- see ticket status and priority.

Direct unauthenticated access displays an Account sign-in prompt. No public anonymous support form is exposed while Turnstile activation is pending.

## Database model

Migration: `crypto_lab_v79_support_workflow`.

Tables:

- `crypto_support_tickets`;
- `crypto_support_messages`.

Both tables use RLS with explicit deny policies for `anon` and `authenticated`. The browser cannot directly select, insert or modify support rows. All access goes through bounded RPC functions.

User RPC functions:

- `create_crypto_support_ticket(category, subject, message)`;
- `get_my_crypto_support_tickets()`;
- `reply_crypto_support_ticket(ticket_id, message)`.

Controls:

- maximum 5 open/in-progress tickets per user;
- maximum 2 new tickets per 10 minutes;
- maximum 5 user replies per minute;
- subject length 3–120 characters;
- message length 1–4000 characters;
- category, status and priority values are allow-listed;
- ownership is derived only from `auth.uid()`.

## Admin support queue

File: `v79/admin-support.js`.

The protected admin panel displays:

- open, in-progress, resolved and closed counts;
- user email and display name;
- complete ticket conversation;
- status and priority controls;
- optional admin reply.

Admin RPC functions:

- `get_crypto_admin_support()`;
- `admin_update_crypto_support_ticket(ticket_id, status, priority, message)`.

Both functions verify the authenticated user's `crypto_user_profiles.role = admin` on the server. The browser cannot assign itself the admin role.

## Data portability and deletion

`crypto-lab-v79-data-export` version 2 now includes:

- user support tickets and their messages;
- legal acceptance records;
- all previously exported account, portfolio, journal, backtest, AI, billing and subscription data.

Support tickets reference `auth.users` with `ON DELETE CASCADE`; ticket messages reference tickets with `ON DELETE CASCADE`. A completed account deletion therefore removes the user's support conversations as well.

`crypto-lab-v79-admin-deletions` version 2 now includes legal acceptances, support tickets, support messages and the deletion request itself in the pre-deletion audit count. The privacy-preserving deletion audit therefore reports the complete user-owned row count for the expanded v79 schema.

## Operational health

Migration `crypto_lab_v79_support_operational_health` extended the protected admin health RPC with:

- open support count;
- in-progress support count;
- resolved and closed counts;
- urgent unresolved count;
- age of the oldest unresolved ticket.

This makes unresolved customer support part of commercial launch operations rather than a separate unmonitored feature.

## Performance

Migration `crypto_lab_v79_support_and_legal_performance` added covering indexes for:

- support-message authors;
- assigned support administrators;
- legal document/version foreign keys.

The legal acceptance RLS policy now initializes `auth.uid()` once per query. After rechecking the Supabase performance advisor, foreign-key and RLS initialization warnings were cleared; only informational unused-index notices remain on new or empty production tables.

## Verification

Temporary local-only Auth rows were inserted directly in the database; no hosted sign-up endpoint and no email delivery were used.

Verified sequence:

1. user created a Technical support ticket;
2. user retrieved only their ticket;
3. user added a reply;
4. admin retrieved the queue;
5. admin changed priority to High, added a response and resolved the ticket;
6. admin counts changed from Open 1 to Resolved 1;
7. deleting the temporary Auth rows cascaded to zero test users, tickets and messages;
8. the operational health RPC returned the new support metrics;
9. unauthenticated data-export and admin-deletion requests returned HTTP 401.

Public validator confirmed HTTP 200 and valid JavaScript for:

- `index.html`;
- `app.html`;
- `support-extension.js`;
- `service-worker.js`;
- `support.html`;
- `admin-support.js`.

The validator was restored to mandatory JWT after verification.

No email was sent. Public registration and password recovery remain disabled until Cloudflare Turnstile keys and explicit activation flags are configured.
