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
