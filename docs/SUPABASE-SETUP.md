# Supabase setup

Use a separate test Supabase project and synthetic records only.

1. Create a dedicated **test** Supabase project in an account controlled by the project owner. Use synthetic records only.
2. Install the Supabase CLI and sign in locally with `supabase login`. Do not share the access token.
3. Copy the project reference from Project Settings → General. Link this repository with `supabase link --project-ref YOUR_PROJECT_REF`.
4. In Project Settings → API, copy the Project URL and publishable/anon key. Locally copy `.env.example` to `.env.local` and fill in only those two browser-safe values.
5. Run `npm install`, `npm run check:supabase`, and `npm run build` before deploying.
6. Preview the pending database changes with `supabase db push --dry-run`. If the target is the new empty test project and the migration list is correct, apply with `supabase db push`. This applies the thirteen SQL migrations in filename order; do not paste or deploy them as Edge Functions.
7. Confirm the remote migration history contains all thirteen migrations with `supabase migration list`.
8. Deploy the three Edge Functions only after the database migrations succeed:
   - `supabase functions deploy create-customer-link-invite`
   - `supabase functions deploy redeem-customer-link-invite`
   - `supabase functions deploy list-customer-link-claims`
9. In Authentication → URL Configuration, set the exact local and deployed redirect URLs.
10. In Authentication → Providers, enable Email and keep email confirmation enabled for testing.
11. Run `npm run dev` locally and test with two separate synthetic shop-owner accounts plus one customer account.

## Important security and testing notes

- Use only the publishable/anon key in the browser. Never expose the service_role key.
- The initial schema creates one shop for each new signup using the shop name in signup metadata.
- Shop-owner access to shop records is protected by RLS. Customer accounts and pending invitation claims are implemented as a limited foundation, but claim approval/rejection, verified identity, customer-controlled ledger consent, cross-shop sharing, and support review are not implemented.
- The offline draft review screen supports per-draft and batch sync, but live sync requires all four migrations, valid Supabase configuration, and a real authenticated test session.
- Migration files committed to GitHub are not automatically applied to Supabase. Confirm the SQL editor reports success for every migration.
- Test Row Level Security with at least two separate test shop-owner accounts and verify neither account can read or write the other's records.
- The offline queue is stored in IndexedDB and is not encrypted by this app. Do not put real financial or identity information in it. Avoid shared devices.
- Test interrupted requests and retry behaviour before relying on idempotency. Migration 004 adds the unique client_ref index used by sync.
- The dedicated test Supabase project has migrations 001–013 applied. Browser credentials are not committed to the repository. Authenticated end-to-end tests have not yet been completed.
- Obtain adult oversight and appropriate legal/security review before any real-world use.

## Customer account foundation (migration 005)

Migration 005 adds a `profiles.account_type` label and lets signup create a customer account without creating a shop. Migration 006 prevents an authenticated user from changing that database field through normal profile updates. The label is for interface routing only. It is not proof of identity and must never be used as authorization. Existing shop-owner RLS remains the data boundary.

Customer accounts can redeem an invitation and submit a pending claim after migrations 005–008 and the related Edge Functions are deployed. A pending claim does not link the account, grant sharing permission, or allow the customer to read shop ledgers or another shop's data. Claim approval/rejection and customer-controlled ledger consent are not implemented. Apply migration 005 after migration 004 before testing customer signup. Test with synthetic accounts only.

## Customer link invitation function (migration 007)

Migration 011 makes the per-owner hourly invitation limit atomic under concurrent requests and adds server-side audit triggers. Migration 012 adds the missing composite foreign-key index for reminders. Migration 013 changes the shop-owner helper to SECURITY INVOKER so it no longer needs elevated database rights.\n\nThe Edge Function `create-customer-link-invite` creates a one-time code for a customer record. It verifies the caller's session, checks shop ownership and customer/shop matching with the caller's JWT, enforces an atomic limit of 10 code creations per owner per hour, stores only a SHA-256 hash, and returns the raw code once. Codes expire after a selected 1–72 hours (24 by default).

## Customer invitation redemption and pending claims (migration 008)

Apply `supabase/migrations/008_customer_link_claims.sql` after migration 007. Then deploy the three Edge Functions:

```sh
supabase functions deploy create-customer-link-invite
supabase functions deploy redeem-customer-link-invite
supabase functions deploy list-customer-link-claims
```

The redemption function accepts a code only from an authenticated customer account. The database atomically marks the invitation as used and creates a private pending claim. Unknown, expired, revoked, and previously redeemed codes receive the same generic error. The claim table is inaccessible to browser roles.

The list function requires a signed-in shop owner and verifies ownership of the requested shop using that owner's JWT before reading claims with the server-side service role. It returns only pending claim IDs, submission dates, status, customer display names, and masked phone numbers. It does not return balances, notes, ledger rows, or customer account identifiers.

A successful redemption is **not approval**. It does not link the account, show balances, or expose ledger rows. This endpoint is a read-only review list; approval/rejection, identity verification, dispute handling, and a separate secure approval flow remain unimplemented. Use synthetic records only.

The Supabase Edge Function runtime supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never copy the service-role key into the app, browser, GitHub source, or chat.


## Deployment preflight and verification (tasks 11–13)

The repository includes a repeatable static preflight:

```sh
npm run check:supabase
npm run build
```

The preflight checks that all thirteen expected migration files are present, that no unexpected SQL migration is silently added to this reviewed deployment set, that all three Edge Functions exist with JWT verification enabled, and that service-role credential names do not appear in browser source or the browser environment example. GitHub Actions runs this preflight before the production build.

After linking a dedicated test project, use:

```sh
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
supabase functions deploy create-customer-link-invite
supabase functions deploy redeem-customer-link-invite
supabase functions deploy list-customer-link-claims
supabase functions list
```

Do not use `--include-all` to force migrations into a project with unknown history. Stop if the remote migration history differs from the expected thirteen files and review it first. Do not run these commands against a production database during initial testing.

### Live acceptance checklist

- [ ] Two separate synthetic shop-owner accounts can only read their own shops/customers/ledger.
- [ ] A customer account cannot read shops, customers, balances, or ledger rows directly.
- [ ] A shop owner can create an invitation only for a customer record in their own shop.
- [ ] The raw invitation code is shown once; only its SHA-256 hash is stored.
- [ ] An unauthenticated request is rejected by each Edge Function.
- [ ] A shop owner cannot redeem a customer invitation.
- [ ] A customer can redeem a valid invitation once and receives only a pending claim.
- [ ] Expired, unknown, and reused codes fail with the same generic response.
- [ ] A second shop owner cannot list another shop's pending claims.
- [ ] Pending claims contain no balance, note, or ledger data.
- [ ] No request path grants ledger access merely because a claim is pending.

A static CI pass is not a live Supabase security test. Do not describe the system as production-secure until these checks have been run against the actual test project and reviewed.
