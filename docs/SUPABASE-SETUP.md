# Supabase setup

Use a separate test Supabase project and fake records only.

1. Create a Supabase project in your own account.
2. In Project Settings → API, copy the Project URL and publishable/anon key.
3. Locally copy `.env.example` to `.env.local` and fill in those two values.
4. In Supabase SQL Editor, apply these migrations **in this exact order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_security_hardening.sql`
   - `supabase/migrations/003_payment_reminders.sql`
   - `supabase/migrations/004_ledger_offline_idempotency.sql`
5. In Authentication → URL Configuration, set the local and deployed redirect URLs.
6. In Authentication → Providers, enable Email. Configure email confirmation before public use.
7. Run `npm install` and `npm run dev`.

## Important security and testing notes

- Use only the publishable/anon key in the browser. Never expose the `service_role` key.
- The initial schema creates one shop for each new signup using the shop name in signup metadata.
- This schema currently supports shop-owner access only. Customer self-service accounts, verified consent, cross-shop sharing, and support review are not enabled.
- Before entering any real customer information, test Row Level Security with at least two separate test shop-owner accounts and verify that neither account can read or write the other's records.
- The offline queue is local browser storage and is not encrypted by this app. Do not put real financial or identity information in it.
- The pending-draft review and user-triggered sync interface is not yet complete. The sync helper must not be treated as a finished user feature.
- The migrations have not been confirmed as applied to a live Supabase project. Applying them is a separate step from committing SQL files to GitHub.
- Obtain adult oversight and appropriate legal/security review before any real-world use.
