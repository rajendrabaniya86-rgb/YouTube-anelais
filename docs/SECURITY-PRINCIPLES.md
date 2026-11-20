# Security and privacy principles

- Enforce tenant isolation in the database using Row Level Security. UI hiding is not security.
- A shop may access only its own customers and ledger entries.
- Cross-shop disclosure must be purpose-specific, time-bounded, revocable where legally possible, and backed by recorded customer consent.
- Collect the minimum personal data needed. Mask phone numbers in general views.
- Never store raw fingerprint, face, or other biometric templates in this app.
- Keep a tamper-evident audit trail for entry creation, correction, dispute, and resolution.
- Do not silently delete settled transactions. Use reversal/correction entries with reasons.
- Encrypt traffic; protect secrets in server-side environment variables, never in frontend code or Git.
- Provide export and account deletion workflows consistent with legal retention obligations.
- AI outputs are advisory summaries, explain their evidence, and must not make lending decisions.
- Nepal privacy and financial/credit-information laws require qualified local legal review before a public launch.

## Current prototype warning
The first UI uses hard-coded sample records and browser state only. It has no real authentication, server, database, access control, or durable storage. Do not enter real customer information.
