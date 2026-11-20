# Supabase setup

1. Create a Supabase project in your own account.
2. In Project Settings → API, copy the Project URL and publishable/anon key.
3. Locally copy `.env.example` to `.env.local` and fill in those two values.
4. In Supabase SQL Editor, run `supabase/migrations/001_initial_schema.sql`.
5. In Authentication → URL Configuration, set the local and deployed redirect URLs.
6. In Authentication → Providers, enable Email. Configure email confirmation before public use.
7. Run `npm install` and `npm run dev`.

## Important
- Use only the publishable/anon key in the browser. Never expose the service_role key.
- The initial schema creates one shop for each new signup using the shop name in signup metadata.
- This first migration supports shop-owner access only. Customer self-service accounts, customer consent verification, cross-shop sharing, and support review are not enabled yet.
- Before real customer records are entered, test Row Level Security with two separate shop-owner accounts and have the schema reviewed.
