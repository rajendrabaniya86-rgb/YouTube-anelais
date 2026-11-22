# Custom SMTP setup for Global Trust Network

This guide keeps email/password signup, email confirmation, resend-confirmation, and password recovery enabled while moving Auth email delivery away from Supabase's shared test mailer.

## Current status

- The app code already keeps email/password authentication and email confirmation.
- Supabase's built-in mailer is for testing. Its current documented limit is 2 messages per hour and it only sends to project-team-authorized addresses.
- Custom SMTP is **not yet active**. It cannot be enabled from this repository alone because the provider's SMTP password and a verified sender domain must be supplied securely by the project owner.
- Do not put SMTP credentials, provider API keys, Supabase access tokens, or service-role keys in this repository, app code, GitHub Actions secrets, screenshots, or chat messages.

## What is needed before configuration

1. A domain or subdomain controlled by the project owner, with access to edit its DNS records. If no domain is already available, pause here; do not invent a sender address or use someone else's domain.
2. A transactional email provider account that supports SMTP (Resend is one supported option).
3. Provider-generated DNS records and a sender address on the verified domain.
4. An SMTP credential/API key created for sending only.

If the project owner is a minor, a parent or guardian should handle any account registration, domain ownership, billing, or provider terms.

## Recommended provider: Resend

After the domain is available:

1. In the provider dashboard, add the domain or a dedicated mail subdomain, such as `mail.example.com`.
2. Copy the exact DNS records shown by the provider into the domain's DNS manager. Do not copy example DNS values from this guide.
3. Wait until the provider marks the sending domain as verified.
4. Create a restricted sending API key. Keep it private.
5. Use a sender address on the verified domain, for example `no-reply@mail.example.com`.

Resend SMTP values:

| Supabase field | Value |
| --- | --- |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` |
| SMTP username | `resend` |
| SMTP password | The private Resend API key |
| Sender email | An address on the verified sending domain |
| Sender name | `Global Trust Network` |

Use port 465 with implicit TLS. If the provider dashboard recommends another supported port for the account, follow its current instructions.

## Enter settings in Supabase

Using an account authorized to manage the project:

1. Open the **Global-trust-network-test** Supabase project.
2. Open **Authentication** settings and find **SMTP Settings / Custom SMTP**.
3. Enable custom SMTP.
4. Enter the sender name, sender email, host, port, username, and password from the table above.
5. Save the settings. Keep email confirmation enabled. Do not enable auto-confirm as a workaround.
6. Review Auth rate limits and CAPTCHA protection before inviting real users.

Credentials must be entered directly into the provider and Supabase dashboards by the authorized project owner. Never send them to the app, GitHub, or this chat.

## Verification checklist

Use only test accounts you control:

- Sign up with a test email address and confirm the message arrives.
- Open the confirmation link on the same app installation and verify it returns to the app.
- Test resend confirmation and password recovery.
- Check provider delivery logs and Supabase Auth logs for the same test attempt.
- Check the recipient inbox and spam folder. A Supabase `mail.send` log alone means the handoff was attempted; it does not prove inbox delivery.
- Confirm email confirmation is still required and test that an unconfirmed account cannot sign in.
- Test Google, GitHub, and phone login separately; SMTP does not configure those providers.

Do not claim SMTP is working until a real test message is received and the provider reports successful delivery.

## Important limits

Supabase documents an initial custom-SMTP rate limit of 30 messages per hour. This is not unlimited sending. Configure a suitable limit only after checking the provider's own limits and adding abuse protection.

## Official documentation

- [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend: SMTP service settings](https://resend.com/changelog/smtp-service)
