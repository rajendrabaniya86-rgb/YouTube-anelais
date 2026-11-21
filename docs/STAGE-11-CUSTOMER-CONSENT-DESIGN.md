# Stage 11: Customer-controlled consent design gate

## Purpose
Define the safe customer-side confirmation and consent boundary before any customer account can view a shop ledger. This stage is a design and security contract only. It does not enable ledger access, verify legal identity, or authorize cross-shop sharing.

## Non-negotiable rules
1. A shop-owner-approved claim is only a request to continue. It is not proof that the claimant is the named customer.
2. The customer must sign in to their own account and explicitly confirm the exact shop/customer relationship before consent can be recorded.
3. Consent must be specific to one shop, one customer record, one stated purpose, and a bounded time period. No blanket or implied consent.
4. The customer must see the requested purpose, shop identity, data categories, expiry, and revocation method.
5. Revocation must stop future reads immediately without erasing historical consent/audit events.
6. The customer must never enumerate claims, customer records, or ledger rows belonging to another account.
7. Authorization must be enforced in PostgreSQL/RLS or narrowly scoped server-side functions. Never expose service-role or secret keys in the browser.
8. Shop staff cannot create, edit, or revoke customer consent on the customer's behalf.
9. Phone-number matching alone is not identity verification. Any stronger method needs a separate privacy and abuse review.
10. No balances, notes, or transaction history may be exposed while a claim is pending, rejected, expired, or unconfirmed.

## Required data and state model
Keep these states distinct:
- pending_shop_review
- shop_approved_waiting_customer
- customer_confirmed
- consent_granted
- consent_revoked
- expired
- rejected

A database function must check the authenticated actor and current state for every transition. Repeated requests must be idempotent or safely rejected. Every transition must create an append-only audit event.

## Customer confirmation requirements
- Show a masked shop identity and enough non-sensitive context to recognize the request.
- Require an active customer choice to confirm or reject. Never default to opt-in.
- Scope confirmation to the exact pending claim and authenticated customer account.
- Do not let the customer change target shop or customer-record IDs in the request.
- State clearly that confirmation alone does not grant ledger access.

## Consent grant requirements
Product/legal review must settle permitted data categories and purposes before implementation. The grant function must reject empty purpose, unknown categories, invalid expiry, mismatched claim/customer/shop IDs, and non-customer actors. Only the customer account may grant consent.

## Revocation requirements
- Customer can revoke active consent at any time.
- Read policies must check active consent on every request, not trust a stale frontend flag.
- Revocation must prevent subsequent reads even if the customer previously opened the page.
- Explain that existing exports or screenshots cannot be recalled.
- Retain revocation records in the audit history.

## Security test matrix required before implementation is complete

| Test | Expected result |
|---|---|
| Unauthenticated user confirms a claim | Denied |
| Customer A confirms Customer B's claim | Denied |
| Customer changes claim/shop/customer IDs | Denied |
| Shop owner attempts to grant consent for customer | Denied |
| Customer confirms but does not grant consent | No ledger access |
| Consent for one shop is active | Only permitted data for that shop is readable |
| Customer requests another shop's data | Denied |
| Customer revokes consent | Subsequent reads denied |
| Expired consent is used | Denied |
| Replayed confirmation or grant request | No duplicate or broadened permission |
| Direct REST access bypass attempt | Denied by RLS |
| Audit event update/delete attempt | Denied |

## Release gates
- Reviewed threat model and abuse-case review exist.
- Exact identity-confirmation method is approved.
- Database functions and RLS policies are reviewed together.
- Tests run with at least two customer accounts and two separate shop-owner accounts.
- Consent grant, expiry, and revocation are verified with SQL-level tests.
- No real customer data is used before independent security and qualified local legal review.

## Explicitly out of scope
Legal identity/KYC verification, cross-shop credit scoring or reputation profiles, public debtor lists, automated lending decisions, AI lending recommendations, and production customer-ledger access.

## Current status
Stage 10's automated and real-device checks remain pending. This Stage 11 document records the next product/security gate only; it is not evidence that customer consent or ledger access has been implemented. Keep the app in synthetic-data test mode.
