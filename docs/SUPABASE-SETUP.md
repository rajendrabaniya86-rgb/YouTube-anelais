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
