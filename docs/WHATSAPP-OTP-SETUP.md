# WhatsApp phone OTP setup

The app now has an optional **WhatsApp OTP** path alongside the existing email/password and Google sign-in paths. It requests a 6-digit code through Supabase Auth and verifies it using Supabase Auth. It does not send messages directly from the Android app.

## Required one-time Supabase setup

WhatsApp delivery is not active just because the UI is present. Supabase currently supports WhatsApp as the phone OTP channel only with **Twilio or Twilio Verify**.

1. In Supabase Dashboard, open Authentication → Sign In / Providers → Phone and enable Phone authentication.
2. Configure the Phone provider with Twilio or Twilio Verify credentials in the Supabase Dashboard. Keep all provider secrets in the Dashboard, never in the app, GitHub source, or a Vite environment variable.
3. For Twilio Verify, create a Verify service and configure its Service ID and credentials in Supabase. WhatsApp is supported by Twilio Verify.
4. For Twilio Programmable Messaging, complete Twilio WhatsApp sender onboarding, create/approve the required WhatsApp message template, and enter the Twilio Content SID in Supabase's Phone provider settings.
5. Save the settings and test with a phone number you control. WhatsApp delivery may have provider charges, sender/template restrictions, and rate limits.

Official Supabase guide: https://supabase.com/docs/guides/auth/phone-login

## App behavior

- Email/password signup, email confirmation, resend confirmation, and Google OAuth remain available.
- WhatsApp signup sends the profile metadata (name, account type, and shop name for shop owners) with the phone OTP request.
- WhatsApp login does not silently create a new account. A phone number must already have a phone identity.
- OTP verification uses Supabase Auth's phone OTP verification endpoint.
- Phone OTP users are a separate Supabase Auth identity unless their phone number is linked to an existing account. A person who already has an email-based account should not assume that using a different phone number automatically opens the same shop/account.
- Do not use repeated OTP requests to test delivery. Supabase/provider rate limits still apply.

## Test checklist

1. Confirm Phone provider is enabled and WhatsApp provider credentials/sender are saved in Supabase.
2. Create a synthetic shop-owner account with a phone number in international format (for Nepal, +977 followed by the mobile number).
3. Confirm the WhatsApp message arrives and enter the 6-digit OTP.
4. Confirm the account opens and its shop/profile metadata is correct.
5. Log out and test WhatsApp login using the same phone number.
6. Confirm email/password and Google login still work.
