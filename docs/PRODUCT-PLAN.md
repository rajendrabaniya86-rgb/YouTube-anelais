# Product plan

## Product promise
A simple, transparent ledger connecting a shopkeeper and a customer around the same accurately recorded transactions.

## MVP (build in this order)
1. Shop owner authentication and shop profile.
2. Customer records owned by one shop.
3. Credit and payment entries with amount, timestamp, note, and creator.
4. Balance computed from ledger entries, not manually overwritten.
5. Customer statement and receipt.
6. Customer account-to-record verification and customer-controlled consent flow (not implemented; migration 016 adds only the shop-owner's initial claim review).
7. Purpose-limited report sharing with immediate revocation and append-only access audit.
8. Dispute workflow and append-only correction history.
9. Backup, export, and offline-safe sync.

## Later capabilities
- Customer-owned account spanning participating shops, only after identity verification and consent.
- Optional reminders that are respectful and can be disabled.
- AI summaries of verified, permissioned records with clear source and uncertainty.
- Fraud signals for duplicate entries, unusual edits, and suspicious receipt patterns.
- Multilingual interface and voice-assisted entry after explicit confirmation.

## Out of scope for first release
- Public debtor lists or public reputation scores.
- Automated loan approval, rejection, or pricing.
- Fingerprint-based identity search.
- Payment collection or money custody by the app.
- Stock, tax, and full accounting suite until ledger MVP is reliable.

## Key product roles
- Shop owner: manages their shop, customers, and entries.
- Customer: sees and disputes their own shared ledger.
- Support reviewer: handles disputes under controlled access with an audit trail.

## Release gates
No real customer data until authentication, database row-level security, consent records, backups, and privacy review have passed testing.
