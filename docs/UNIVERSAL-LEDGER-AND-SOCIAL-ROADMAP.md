# Global Trust Network: delivery order and paid-service boundaries

## Product direction

- One person has one permanent GTN ID.
- A person can act as a customer, shopkeeper, creator, or other role without creating a second identity.
- Customers can connect to participating shops and view a single combined ledger, but only after the shop verifies the record and the customer explicitly grants access.
- Chat, social posting, and media are separate services built on the same identity.

## Phase 1: universal ledger (current priority)

1. Keep the existing shop ledger and its append-only credit/payment history.
2. Assign every profile a permanent, unique GTN ID.
3. A shop sends a one-time customer-link invitation.
4. The customer redeems it; the shop reviews the claim.
5. Shop approval is not consent. The customer separately confirms ledger access.
6. The customer dashboard aggregates only records from shops where access is currently active.
7. The customer can revoke a shop connection. Revocation stops future reads; historical audit events remain.
8. A customer can see shop name, credit entries, payments, dates, notes, and per-shop/overall outstanding totals.
9. A shopkeeper sees only their own shop's customers and ledger.
10. Disputes and corrections must preserve the original transaction history.

### Financial boundary

This phase is a record-keeping ledger, not a bank or wallet. It does not accept deposits, hold funds, transfer money, initiate payments, or claim a bank balance. Real payment-provider or bank integration is a later, separately approved project requiring official APIs, contracts, and applicable regulatory review.

## Phase 2: social network

- GTN ID search and connection requests.
- User profile with privacy controls.
- Posts, reactions, comments, and follows.
- Shop pages and business updates.
- Block, report, moderation, and abuse controls.

## Phase 3: paid subscriptions and communication

- Chat and group messaging can be subscription-gated.
- Premium social tools can be subscription-gated.
- Photo/video upload, longer media, and creator tools can be paid-tier features.
- Subscription status must be verified server-side. Hiding a button in the app is not access control.
- The app must show plan, price, billing period, renewal/cancellation terms, and a way to cancel before purchase.
- Never store card or bank credentials in GTN. Use an approved billing provider and its signed webhooks; grant/revoke entitlements server-side.
- Provide a free/basic tier and clear limits so essential identity and ledger access are not held hostage by a social subscription.

## Not included in the current implementation

- Real banking, deposits, wallet custody, money transfers, loans, credit scoring, or automatic lending decisions.
- Public debt lists or public personal debt rankings.
- Cross-shop ledger visibility without both shop verification and customer consent.
- Paid subscription collection until the billing provider, legal terms, and server-side webhook verification are implemented.

## Release gates

- Test with synthetic accounts and synthetic transactions only.
- Verify customer A cannot read customer B's records.
- Verify a customer cannot see a shop ledger before explicit consent.
- Verify revocation immediately removes access.
- Verify one shop cannot read another shop's records.
- Run SQL migration checks, UI tests, production build, and Android build before release.
- Do not call the product production-ready until live-backend security, mobile, and privacy tests pass.
