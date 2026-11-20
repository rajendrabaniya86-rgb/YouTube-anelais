# Task 6: Offline behaviour and data security

## Offline behaviour
- The app reports online/offline state.
- The service worker caches only the static app shell and same-origin hashed frontend assets.
- Authentication endpoints, Supabase/API requests, customer records, and ledger data are never placed in the service-worker cache.
- In demo mode, sample records and demo entries remain in this browser's local storage. They are not encrypted and must never contain real customer or financial information.
- In live mode, creating customers or ledger entries is blocked while offline. Reconnect before writing. This avoids silently queueing sensitive financial data on a shared device.

## Security controls
- Supabase Row Level Security isolates shop data.
- Migration 001's customer policy has been corrected so it can be applied on a fresh project.
- Migration 002 replaces broad customer rules with explicit shop-scoped rules and verifies that ledger/consent rows reference a customer from the same shop.
- Ledger and audit history are append-only at the database trigger level. Corrections should be added as new reversal/correction entries.
- Vercel response headers add MIME sniffing, framing, referrer, permissions, and opener protections.
- The frontend must use only the Supabase anon/publishable key. Never put a service-role key in browser code or commit secrets.

## Setup and verification
1. Apply `001_initial_schema.sql` to a fresh Supabase project.
2. Apply `002_security_hardening.sql` next.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables.
4. Test with two separate test accounts and verify neither can read the other's shop, customer, ledger, or consent records.
5. Verify that authenticated users cannot update/delete ledger or audit rows.
6. Test airplane mode: static app shell should open after a first successful visit; live customer/ledger data should not be available offline.

This is a learning prototype, not a production financial service. Use synthetic data only until adult oversight, independent security testing, and local legal/privacy review are complete.
