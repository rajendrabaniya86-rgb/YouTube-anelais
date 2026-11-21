# Supabase setup

Use a separate test Supabase project and synthetic records only.

1. Create a Supabase project in your own account.
2. In Project Settings → API, copy the Project URL and publishable/anon key.
3. Locally copy .env.example to .env.local and fill in those two values.
4. In Supabase SQL Editor, apply these migrations in this exact order:
   - supabase/migrations/001_initial_schema.sql
   - supabase/migrations/002_security_hardening.sql
   - supabase/migrations/003_payment_reminders.sql
   - supabase/migrations/004_ledger_offline_idempotency.sql
   - supabase/migrations/005_customer_account_foundation.sql
   - supabase/migrations/006_protect_account_type.sql
   - supabase/migrations/007_customer_link_invites.sql
   - supabase/migrations/008_customer_link_claims.sql
5. In Authentication → URL Configuration, set the local and deployed redirect URLs.
6. In Authentication → Providers, enable Email. Configure email confirmation before public use.
7. Run npm install and npm run dev.

## Important security and testing notes

- Use only the publishable/anon key in the browser. Never expose the service_role key.
- The initial schema creates one shop for each new signup using the shop name in signup metadata.
- The current database model supports shop-owner access only. Customer self-service accounts, verified consent, cross-shop sharing, and support review are not implemented.
- The offline draft review screen supports per-draft and batch sync, but live sync requires all four migrations, valid Supabase configuration, and a real authenticated test session.
- Migration files committed to GitHub are not automatically applied to Supabase. Confirm the SQL editor reports success for every migration.
- Test Row Level Security with at least two separate test shop-owner accounts and verify neither account can read or write the other's records.
- The offline queue is stored in IndexedDB and is not encrypted by this app. Do not put real financial or identity information in it. Avoid shared devices.
- Test interrupted requests and retry behaviour before relying on idempotency. Migration 004 adds the unique client_ref index used by sync.
- No Supabase project or credentials are configured by this code change, and no live database migration has been verified here.
- Obtain adult oversight and appropriate legal/security review before any real-world use.

## Customer account foundation (migration 005)

Migration 005 adds a `profiles.account_type` label and lets signup create a customer account without creating a shop. Migration 006 prevents an authenticated user from changing that database field through normal profile updates. The label is for interface routing only. It is not proof of identity and must never be used as authorization. Existing shop-owner RLS remains the data boundary.

Customer accounts currently see a clear placeholder screen. They cannot link customer records, read shop ledgers, grant sharing permissions, or view another shop's data. Those features require a separately verified account-linking and customer-controlled consent implementation. Apply migration 005 after migration 004 before testing customer signup. Test with synthetic accounts only.

## Customer link invitation function (migration 007)

The Edge Function `create-customer-link-invite` creates a one-time code for a customer record. It verifies the caller's session, checks shop ownership and customer/shop matching with the caller's JWT, limits each owner to 10 code creations per hour, stores only a SHA-256 hash, and returns the raw code once. Codes expire after a selected 1–72 hours (24 by default).

## Customer invitation redemption and pending claims (migration 008)

Apply `supabase/migrations/008_customer_link_claims.sql` after migration 007. Then deploy the three Edge Functions:

```sh
supabase functions deploy create-customer-link-invite
supabase functions deploy redeem-customer-link-invite
supabase functions deploy list-customer-link-claims
```

The redemption function accepts a code only from an authenticated customer account. The database atomically marks the invitation as used and creates a private pending claim. Unknown, expired, revoked, and previously redeemed codes receive the same generic error. The claim table is inaccessible to browser roles.

The list function requires a signed-in shop owner and verifies ownership of the requested shop using that owner's JWT before reading claims with the server-side service role. It returns only pending claim IDs, submission dates, status, customer display names, and masked phone numbers. It does not return balances, notes, ledger rows, or customer account identifiers.

A successful redemption is **not approval**. It does not link the account, show balances, or expose ledger rows. This endpoint is a read-only review list; approval/rejection, identity verification, dispute handling, and a separate secure approval flow remain unimplemented. Use synthetic records only.

The Supabase Edge Function runtime supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never copy the service-role key into the app, browser, GitHub source, or chat.
