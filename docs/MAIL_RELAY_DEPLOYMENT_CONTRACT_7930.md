# CRYPTO LAB v79 — Provider-Neutral Mail Relay Deployment Contract

Date: 2026-08-05  
Build: 7930  
Activation: disabled

## Purpose

This contract defines the relay that may deliver CRYPTO LAB authentication messages after external mail-provider configuration is supplied. It does not select a provider, create a mailbox, send a message or activate registration/recovery.

The public account page never sends mail and never receives provider credentials. Registration and recovery call protected Edge Functions. Those functions call `crypto-lab-mail-dispatch`, and the dispatcher may call only the configured relay endpoint.

## Trust boundaries

1. Browser to registration/recovery Edge Function: public pre-auth request protected by exact origin, Turnstile, rate limits, bounded input and generic responses.
2. Registration/recovery Edge Function to dispatcher: service-role bearer and `apikey` are both required.
3. Dispatcher to relay: a non-secret publishable routing key plus a separate private relay secret are required.
4. Relay to provider: provider API credential remains only in the relay runtime secret store.
5. Provider response to CRYPTO LAB: provider message identifiers and raw provider payloads are not exposed to the browser.

## Allowed request

The relay accepts only the strict request schema at `docs/schemas/crypto-mail-relay-request-v1.schema.json`:

- `to` — bounded email address;
- `template` — `signup_confirmation` or `password_recovery`;
- `locale` — `ru`, `uk` or `en`;
- `action_url` — HTTPS only, bounded to 4096 characters;
- `idempotency_key` — required, bounded and format restricted.

Arbitrary subject, HTML and text bodies are forbidden. The relay owns all templates. This prevents the protected service contour from becoming an open-mail endpoint.

## Template requirements

Each template must include:

- CRYPTO LAB identity and purpose of the message;
- a single primary action link;
- a plain-language warning to ignore the message when the user did not request it;
- no trading promise, profit promise or financial recommendation;
- no raw token printed separately from the action URL;
- RU, UA and EN variants maintained as one versioned template set.

The action URL must not be written to application logs, analytics, error telemetry or provider metadata beyond the provider body needed for delivery.

## Idempotency

The relay stores a one-way digest of `idempotency_key` and the terminal delivery outcome. A repeated key must return the same accepted result without sending a second message. Raw recipient and raw action URL are not used as idempotency storage keys.

Recommended retention:

- successful digest records: 30 days;
- temporary-failure records: until terminal outcome plus 7 days;
- raw provider response bodies: not stored unless a bounded redacted error code is required.

## Error semantics

- `202 accepted`: valid request accepted or already accepted under the same idempotency key;
- `400`: strict validation failure;
- `403`: authentication failure;
- `429`: relay-side bounded rate limit;
- `503`: temporary provider or relay unavailability.

Registration may roll back a newly generated account when confirmation mail cannot be accepted. Recovery always returns a generic public response so account existence is not exposed.

## Provider-neutral adapter

The adapter must implement:

- verified sender/domain;
- ten-second provider timeout;
- bounded retries only for retryable transport/status failures;
- no retry for permanent validation/authentication rejection;
- provider credential redaction;
- request/response size bounds;
- timestamped test evidence without recipient password, secret, full action URL or raw token.

## Required controlled tests

The machine contract defines sixteen tests. The minimum evidence for each test is:

- timestamp in UTC;
- relay build/version;
- template and locale;
- synthetic outcome code;
- HTTP status;
- idempotency assertion;
- delivery count assertion;
- redaction assertion;
- provider evidence identifier stored only in the protected evidence record.

No hosted test is permitted until an owned mailbox and provider configuration are supplied. Local contract validation must use synthetic payloads only.

## Activation sequence

1. Owner selects and configures a provider account.
2. Sender/domain is verified at the provider.
3. Relay runtime is deployed with provider credential in its secret store.
4. Supabase secret interface receives `CRYPTO_MAIL_RELAY_URL` and `CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY`.
5. Protected database secret store receives `crypto_lab_mail_relay`.
6. Controlled tests run against the owned mailbox.
7. Logs and evidence are checked for secret/token leakage.
8. `MAIL_RELAY` is verified.
9. Registration/recovery remain disabled until the full Auth E2E sequence is approved and completed.

## Explicit prohibitions

- no provider credential in GitHub;
- no private relay secret in GitHub, public assets, logs or launch registry;
- no arbitrary recipient lists;
- no arbitrary mail content;
- no email sending from browser code;
- no test message to an invented or third-party mailbox;
- no registration/recovery activation from relay readiness alone.
