# CRYPTO LAB repository instructions

## Production Supabase email safety

The hosted Supabase project `txhzxbizjpinowepfjkm` (`crypto-lab-ai`) is a live project. Automated development and E2E checks must not generate outbound Auth email to invented or unowned addresses.

### Forbidden against the hosted project

- Do not call `supabase.auth.signUp`, `/auth/v1/signup`, `resetPasswordForEmail`, OTP/magic-link, invite, or email-change flows with fabricated Gmail, Outlook, Yahoo, iCloud, Proton, or other externally deliverable addresses.
- Do not bypass reserved-domain validation by replacing an `@example.com` test address with a realistic but nonexistent mailbox.
- Do not use the hosted Supabase default SMTP service for automated email-flow testing.

### Required test pattern when no email delivery is being tested

Create a temporary confirmed user through a server-only service-role client, then delete it in cleanup:

```js
const email = `e2e-${Date.now()}@example.com`
const password = crypto.randomUUID() + 'Aa1!'

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (error) throw error

try {
  // Run authenticated checks with the temporary user.
} finally {
  if (data.user?.id) await admin.auth.admin.deleteUser(data.user.id)
}
```

The service-role key must remain server-side and must never be committed or exposed to browser code.

### Required test pattern when email delivery is being tested

Use one of these isolated environments:

1. Local Supabase CLI with Mailpit.
2. A dedicated staging Supabase project connected to an email sandbox such as Mailtrap.
3. A mailbox or plus-alias that is owned and actively monitored by the project owner, only for a deliberate manual test.

### Release check

Before finishing Auth-related work, inspect hosted Auth logs and confirm that there are no `mail.send` events to unowned test addresses. Do not mark the task complete when such events are present.
