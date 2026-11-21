# Security and privacy principles

- Enforce tenant isolation in the database using Row Level Security. UI hiding is not security.
- A shop may access only its own customers and ledger entries.
- Cross-shop disclosure must be purpose-specific, time-bounded, revocable where legally possible, and backed by recorded customer consent.
- Collect the minimum personal data needed. Mask phone numbers in general views.
- Never store raw fingerprint, face, or other biometric templates in this app.
- The `audit_events` table and append-only database protections exist, but automatic audit-event creation for every ledger, consent, invitation, and dispute action is not implemented. Do not describe the current prototype as having a complete tamper-evident audit trail.
- Do not silently delete settled transactions. Use reversal/correction entries with reasons.
- Encrypt traffic; protect secrets in server-side environment variables, never in frontend code or Git.
- Provide export and account deletion workflows consistent with legal retention obligations.
- AI outputs are advisory summaries, explain their evidence, and must not make lending decisions.
- Nepal privacy and financial/credit-information laws require qualified local legal review before a public launch.

## Current prototype warning
The app now has a Supabase authentication flow, shop-scoped database access, RLS migrations, and three server-side customer-link Edge Functions in the dedicated test project. Demo mode still uses hard-coded sample records and browser local storage. The customer-link flow creates a pending claim only; approval, identity verification, consent-based sharing, and customer ledger access are not implemented. Authenticated cross-shop isolation and full end-to-end behavior have not yet been verified. The offline IndexedDB queue is not encrypted. Use synthetic records only; do not enter real customer or financial information.
