# Stage 10: Login and mobile verification checklist

This checklist is for the `rebuild/global-trust-network` branch. Use only the dedicated test Supabase project and synthetic accounts/data. Do not test with real customer balances or personal data.

## Automated checks
- [ ] GitHub Actions installs dependencies.
- [ ] `npm run check:supabase` passes.
- [ ] `npm run build` passes.
- [ ] Review the workflow log for warnings and errors.

## Login and account flows
- [ ] Open the app with valid Supabase URL and publishable/anon key.
- [ ] Register a synthetic shop-owner account and confirm the email flow.
- [ ] Sign in with the confirmed account.
- [ ] Refresh the page and verify the session is restored.
- [ ] Sign out, then sign in again.
- [ ] Try an incorrect password and verify a safe error is shown.
- [ ] Register a synthetic customer account and verify it reaches the customer invite-code screen, not the shop dashboard.
- [ ] Submit an invalid/expired invite code and verify no ledger data is shown.
- [ ] Verify demo mode is clearly labelled and never mistaken for live data.

## Android browser checks
Test on a real Android phone using Chrome (or the target browser):
- [ ] Login and registration screens fit at 320px width without horizontal scrolling.
- [ ] Email and password fields open the correct keyboard and remain usable.
- [ ] Buttons are reachable when the keyboard is open.
- [ ] Page remains usable in portrait and landscape.
- [ ] Refresh preserves a valid session.
- [ ] Offline/online status is displayed correctly.
- [ ] No private ledger information appears before the authenticated shop-owner session is loaded.
- [ ] Customer invite redemption does not expose shop balances or transaction history.

## Security and data isolation
- [ ] Use two synthetic shop-owner accounts and verify each sees only its own shop and customers.
- [ ] Verify a customer account cannot open the shop dashboard or query ledger rows.
- [ ] Verify approval of a claim does not itself grant ledger access.
- [ ] Verify direct browser access to claim/invite tables remains blocked and the intended Edge Functions/RPCs enforce ownership.
- [ ] Confirm no service-role or secret key is present in frontend files, browser bundles, or public environment variables.

## Evidence to record
For each test, record PASS/FAIL, device/browser, date, and a screenshot with emails, phone numbers, invite codes, and balances hidden. Never paste passwords, access tokens, or secret keys into an issue or chat.

## Current limitation
The repository workflow can run automated configuration and production-build checks. It cannot prove the real Android login, email-confirmation, session, or screen-layout flows. Those require a human test on a real device and test accounts. Do not mark this checklist complete until those manual checks have actually been performed.
