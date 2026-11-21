# GLOBAL TRUST NETWORK

A privacy-first, Hindi-first digital ledger prototype for small shops.

## Current implementation status

This branch contains a working frontend prototype and an in-progress Supabase backend foundation:

- Shop-owner signup/login UI (requires Supabase configuration).
- Demo customer records, credit/payment entries, statements, reports, CSV export, and in-app reminders.
- Supabase schema and row-level security migrations for shop-scoped records.
- IndexedDB storage for offline ledger drafts.
- An idempotent server-side upload helper and database uniqueness migration for safe retry handling.

## Important limitations

This is **not production-ready** and must use fake test data only until reviewed and tested:

- Supabase project credentials have not been configured in this repository.
- SQL migrations must be applied manually in order and tested against two separate test shop accounts.
- Offline drafts can be saved locally, reviewed in the pending-drafts screen, and synced manually when online. The queue is not encrypted, and live sync still requires migration 004 plus a configured Supabase project.
- Browser IndexedDB data is not encrypted by this app.
- Customer self-service, verified consent, cross-shop sharing, dispute workflow, notifications, and AI summaries are not implemented as production features.
- No real-device offline test, live Supabase integration test, penetration test, or end-to-end acceptance test has been completed.
- A successful hosting build does not prove database or security behavior.

## Run locally

```bash
npm install
npm run dev
```

## Supabase setup

Follow [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md). Apply migrations in numeric order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_security_hardening.sql`
3. `supabase/migrations/003_payment_reminders.sql`
4. `supabase/migrations/004_ledger_offline_idempotency.sql`

Only use a Supabase publishable/anon key in the browser. Never expose a service-role key.

## Product and privacy principles

- A shop sees only its own customer and transaction records.
- Cross-shop sharing requires clear, purpose-specific, verified customer consent.
- No public payer blacklist or permanent character score.
- Financial corrections must preserve history rather than silently overwrite it.
- Never store raw fingerprint or face data.
- AI may explain verified transaction patterns, but must not make automatic lending decisions.

See [docs/PRODUCT-PLAN.md](docs/PRODUCT-PLAN.md) and [docs/SECURITY-PRINCIPLES.md](docs/SECURITY-PRINCIPLES.md).
