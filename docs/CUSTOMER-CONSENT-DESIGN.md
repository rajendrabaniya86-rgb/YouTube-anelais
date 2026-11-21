# Customer consent and sharing design

Status: design specification only. This is not a live consent feature and does not grant anyone access to records.

## Goal

A customer may choose to share a limited report from one shop with another participating shop. The customer must be able to see, understand, expire, and revoke each permission. A shop owner cannot grant permission on the customer's behalf.

## Roles

- Customer: controls permissions attached to their own verified account.
- Source shop: owns the original ledger and can see its own complete records.
- Recipient shop: sees only the specific approved report and fields, never the source shop's full ledger.
- Support reviewer: may review a dispute only through a separately authorized, audited process.

## Proposed customer flow

1. Customer signs in to their own account.
2. Customer selects the source shop and confirms that the account/ledger belongs to them.
3. Customer chooses a named recipient shop, not an open-ended audience.
4. The screen explains the exact purpose, fields, date range, and expiry before confirmation.
5. Customer explicitly grants access.
6. Customer can view active permissions and revoke any permission at any time.
7. Revocation blocks future reads immediately. Previously downloaded copies cannot be technically recalled, so recipients must be told not to retain or redistribute them.
8. Every grant, read, expiry, and revocation creates an append-only audit event.

## Permission must be narrow

A permission record must bind all of these values:
- verified customer account
- source customer record and source shop
- one recipient shop
- one stated purpose
- approved fields/report type
- optional date range
- grant timestamp and expiry timestamp
- revocation timestamp and actor

No wildcard recipient, public link, public debtor list, or permanent reputation score is allowed.

## Data access rules

- A shop's existing owner-only RLS remains in place.
- A recipient shop must never receive direct SELECT access to source ledger rows.
- A server-side function should return a minimized, purpose-specific report only after checking the current consent, expiry, recipient, and customer mapping.
- The function must re-check consent on every request, not rely on a long-lived cached authorization.
- Customer account-to-customer-record linking requires a separate identity-verification and dispute process. A shopkeeper must not be able to silently link an account.
- Never expose a Supabase service-role key in the browser.
- Keep raw identity documents and biometric data out of this prototype.

## Required screens before implementation

1. Customer account and account-to-record verification.
2. Share request details: recipient, purpose, fields, date range, expiry.
3. Plain-language confirmation screen.
4. My active permissions.
5. Permission details and revoke action.
6. Recipient's limited report view.
7. Dispute and correction entry point.

## Test cases

- Customer A cannot grant access to Customer B's record.
- Shop X cannot read Shop Y's full ledger.
- Recipient Shop Y sees no data before explicit grant.
- Wrong recipient, purpose, field set, or expired grant returns no data.
- Revocation blocks the next report request.
- A customer cannot be linked to a record by an unrelated shop owner.
- Every grant, read, and revoke is auditable.
- A report contains only the fields and date range the customer approved.

## Release gate

This design must not be treated as implemented. Before any real customer data is used, the account-linking model, Nepal privacy and financial requirements, RLS, server-side authorization, consent UX, backups, and independent security review must be completed. Until then, use synthetic test data only.


## Safe account-link invitation foundation (migration 007)

Status: database foundation only. No invitation can be created or redeemed from the app yet.

- Migration 007 creates a one-time invitation table bound to one shop and one customer record.
- Only a SHA-256-sized hash is stored; the raw invitation code must be shown once and never stored.
- Codes expire and can be redeemed once or revoked.
- The browser roles `anon` and `authenticated` have no table privileges. Only a trusted server-side function using the service role may access it.
- The future server function must verify the signed-in shop owner owns the shop before creating an invitation, rate-limit attempts, compare hashes safely, enforce expiry/single-use atomically, and log every attempt.
- Redeeming an invitation only creates a **pending claim**. It must not expose balances or ledger rows. A separate human verification and approval step is required before linking.
- No customer account is linked and no cross-shop access is granted by this migration.

Apply migration 007 after migration 006. This migration has not been applied to a live Supabase project or tested against a live database. Use synthetic test records only.
