# Offline behaviour and data security

## Offline behaviour
- The app reports online/offline state.
- The service worker caches only the static app shell and frontend assets. Authentication requests, Supabase/API responses, customer records, and ledger data are not cached.
- In demo mode, sample records and demo entries are stored in browser local storage. They are not encrypted and must never contain real customer or financial information.
- In live mode, a ledger entry submitted while offline is saved as a pending draft in IndexedDB, scoped to the signed-in user and shop.
- Pending drafts are shown in the Offline Drafts screen. The user must explicitly choose Sync Now or Sync All after reconnecting.
- A draft is removed locally only after the server confirms a successful insert or the app verifies that an earlier retry created the exact same ledger entry.
- The queue is not encrypted. Use synthetic test data only. Do not use it on shared devices or for real financial/identity records.

## Sync and database requirements
- Offline sync uses the stable draft UUID as ledger_entries.client_ref to avoid duplicate entries after an interrupted request.
- Apply all thirteen migrations, 001 through 013, in numeric order before testing the complete live application. At minimum, offline sync requires 001–004; the current test project has 001–013 applied.
- Migration 004 must be present in the database; committing its SQL file to GitHub does not apply it to Supabase.
- Sync requires an authenticated account, matching shop/user scope, internet connectivity, and a valid customer record.
- A failed or conflicting sync leaves the draft in IndexedDB for review. Do not manually delete it to clear an error.

## Security controls
- Supabase Row Level Security is intended to isolate shop data.
- Migration 002 adds explicit shop-scoped rules and checks that ledger/consent rows reference a customer from the same shop.
- Ledger and audit history are append-only at the database trigger level. Migration 011 also writes audit events for shop, customer, ledger, consent, reminder, invitation, and claim changes; dispute events are not available because that workflow is not implemented. Corrections should be new reversal/correction entries.
- Vercel response headers add MIME sniffing, framing, referrer, permissions, and opener protections.
- The frontend must use only the Supabase anon/publishable key. Never put a service-role key in browser code or commit secrets.

## Required verification
1. Use a separate test Supabase project and synthetic data only.
2. Apply migrations 001 through 012 in order for the current full test build; migrations 001–004 are the minimum database foundation for offline sync alone.
3. Test offline draft creation, reconnect, Sync Now, Sync All, retry after a simulated interrupted response, and a mismatched user/shop scope.
4. Verify a failed sync keeps the draft and a confirmed sync removes it exactly once.
5. Test two separate shop-owner accounts and verify neither can read or write the other's records.
6. Verify authenticated users cannot update/delete ledger or audit rows.
7. Test airplane mode after the app has been opened successfully once.

This is a learning prototype, not a production financial service. Adult oversight, independent security testing, and local legal/privacy review are required before any real-world use.
