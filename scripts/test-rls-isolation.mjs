import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !secretKey || !publishableKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SECRET_KEY, or SUPABASE_PUBLISHABLE_KEY repository secrets.');
}

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = randomBytes(6).toString('hex');
const password = `Tt-${randomBytes(24).toString('base64url')}a9!`;
const createdUsers = [];
const fixture = { shopIds: [], customerIds: [], ledgerIds: [], auditIds: [] };
let passed = 0;

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS: ${label}`);
}
async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function createUser(role, shopName = '', uniqueLabel = role) {
  const email = `gtn-${tag}-${uniqueLabel}@example.com`;
  const data = await must(admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `Synthetic ${role}`, account_type: role === 'customer' ? 'customer' : 'shop_owner', ...(shopName ? { shop_name: shopName } : {}) },
  }), `create synthetic ${role}`);
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}
async function asUser(user) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await must(client.auth.signInWithPassword({ email: user.email, password }), `sign in synthetic ${user.email}`);
  if (!session.session?.access_token) throw new Error('Sign-in did not return an access token.');
  return client;
}
async function visibleIds(client, table, id) {
  const data = await must(client.from(table).select('id').eq('id', id), `read ${table}`);
  return data.map(row => row.id);
}
const ownerA = await createUser('shop_owner', `Synthetic Shop A ${tag}`, 'shop-owner-a');
  const ownerB = await createUser('shop_owner', `Synthetic Shop B ${tag}`, 'shop-owner-b');
  const customer = await createUser('customer');

  const shops = await must(admin.from('shops').select('id, owner_id').in('owner_id', [ownerA.id, ownerB.id]), 'load synthetic shops');
  const shopA = shops.find(x => x.owner_id === ownerA.id)?.id;
  const shopB = shops.find(x => x.owner_id === ownerB.id)?.id;
  if (!shopA || !shopB) throw new Error('Auth signup trigger did not create both synthetic shops.');
  fixture.shopIds.push(shopA, shopB);

  const customerA = await must(admin.from('customers').insert({ shop_id: shopA, display_name: `Synthetic Customer A ${tag}`, phone: null, notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id }).select('id').single(), 'create synthetic customer A');
  const customerB = await must(admin.from('customers').insert({ shop_id: shopB, display_name: `Synthetic Customer B ${tag}`, phone: null, notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerB.id }).select('id').single(), 'create synthetic customer B');
  fixture.customerIds.push(customerA.id, customerB.id);

  const ledgerA = await must(admin.from('ledger_entries').insert({ shop_id: shopA, customer_id: customerA.id, entry_type: 'credit', amount: 11, note: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id }).select('id').single(), 'create synthetic ledger A');
  const ledgerB = await must(admin.from('ledger_entries').insert({ shop_id: shopB, customer_id: customerB.id, entry_type: 'credit', amount: 17, note: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerB.id }).select('id').single(), 'create synthetic ledger B');
  fixture.ledgerIds.push(ledgerA.id, ledgerB.id);

  const clientA = await asUser(ownerA);
  const clientB = await asUser(ownerB);
  const clientCustomer = await asUser(customer);

  assert((await visibleIds(clientA, 'customers', customerA.id)).length === 1, 'Shop A can read its own customer');
  assert((await visibleIds(clientA, 'customers', customerB.id)).length === 0, 'Shop A cannot read Shop B customer');
  assert((await visibleIds(clientB, 'customers', customerB.id)).length === 1, 'Shop B can read its own customer');
  assert((await visibleIds(clientB, 'customers', customerA.id)).length === 0, 'Shop B cannot read Shop A customer');
  assert((await visibleIds(clientA, 'ledger_entries', ledgerA.id)).length === 1, 'Shop A can read its own ledger');
  assert((await visibleIds(clientA, 'ledger_entries', ledgerB.id)).length === 0, 'Shop A cannot read Shop B ledger');
  assert((await visibleIds(clientB, 'ledger_entries', ledgerB.id)).length === 1, 'Shop B can read its own ledger');
  assert((await visibleIds(clientB, 'ledger_entries', ledgerA.id)).length === 0, 'Shop B cannot read Shop A ledger');
  assert((await visibleIds(clientCustomer, 'ledger_entries', ledgerA.id)).length === 0, 'Customer cannot read Shop A ledger');
  assert((await visibleIds(clientCustomer, 'ledger_entries', ledgerB.id)).length === 0, 'Customer cannot read Shop B ledger');
  assert((await visibleIds(clientCustomer, 'customers', customerA.id)).length === 0, 'Customer cannot read Shop A customer record');
  assert((await visibleIds(clientCustomer, 'customers', customerB.id)).length === 0, 'Customer cannot read Shop B customer record');

  // Requests made with only the public API key (no signed-in user JWT)
  // must not cross any protected Edge Function boundary.
  for (const functionName of [
    'create-customer-link-invite',
    'redeem-customer-link-invite',
    'list-customer-link-claims',
  ]) {
    const unauthenticated = await publicClient.functions.invoke(functionName, {
      body: functionName === 'create-customer-link-invite'
        ? { shopId: shopA, customerId: customerA.id, expiresInHours: 1 }
        : functionName === 'redeem-customer-link-invite'
          ? { inviteCode: 'unauthenticated-test-code' }
          : { shopId: shopA },
    });
    assert(Boolean(unauthenticated.error),
      `Unauthenticated request is rejected by ${functionName}`);
  }

  // Exercise the real Edge Function boundary with synthetic JWT sessions.
  const inviteResult = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
  });
  assert(!inviteResult.error && typeof inviteResult.data?.inviteCode === 'string',
    'Shop owner can create a valid one-time invite through the Edge Function');
  const inviteCode = inviteResult.data?.inviteCode;

  const wrongShopInvite = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopB, customerId: customerB.id, expiresInHours: 1 },
  });
  assert(Boolean(wrongShopInvite.error),
    'Shop A cannot create an invite for Shop B');

  const ownerRedeemAttempt = await clientA.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode },
  });
  assert(Boolean(ownerRedeemAttempt.error),
    'Shop owner account cannot redeem a customer invite');

  const customerRedeem = await clientCustomer.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode },
  });
  assert(!customerRedeem.error && customerRedeem.data?.status === 'pending',
    'Customer can redeem a valid invite into pending status');

  const repeatRedeem = await clientCustomer.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode },
  });
  assert(Boolean(repeatRedeem.error),
    'A redeemed invite cannot be reused');

  const claimCountResult = await admin.from('customer_link_claims')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerA.id)
    .eq('customer_user_id', customer.id)
    .eq('status', 'pending');
  if (claimCountResult.error) throw new Error(`count synthetic pending claims: ${claimCountResult.error.message}`);
  assert(claimCountResult.count === 1,
    'Repeated redemption creates only one pending claim');

  const ownerClaims = await clientA.functions.invoke('list-customer-link-claims', {
    body: { shopId: shopA },
  });
  assert(!ownerClaims.error && Array.isArray(ownerClaims.data?.claims) &&
    ownerClaims.data.claims.some((claim) => claim.customer?.displayName === `Synthetic Customer A ${tag}`),
    'Shop owner can list its own pending claims');

  const crossShopClaims = await clientB.functions.invoke('list-customer-link-claims', {
    body: { shopId: shopA },
  });
  assert(Boolean(crossShopClaims.error),
    'Shop B cannot list Shop A pending claims');

  const customerListClaims = await clientCustomer.functions.invoke('list-customer-link-claims', {
    body: { shopId: shopA },
  });
  assert(Boolean(customerListClaims.error),
    'Customer account cannot list shop-owner pending claims');

  // Expired and revoked invite codes must fail through the public Edge Function.
  const expiredInvite = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
  });
  assert(!expiredInvite.error && typeof expiredInvite.data?.inviteCode === 'string',
    'Shop owner can create an invite for expiry testing');
  const expiredDigest = createHash('sha256').update(expiredInvite.data.inviteCode).digest('hex');
  const expiredRow = await must(admin.from('customer_link_invites').select('id')
    .eq('created_by', ownerA.id).eq('token_hash', `\\x${expiredDigest}`).single(),
    'find synthetic expiry-test invite');
  await must(admin.from('customer_link_invites').update({ created_at: new Date(Date.now() - 120_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', expiredRow.id).select('id').single(), 'expire synthetic invite');
  const expiredRedeem = await clientCustomer.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode: expiredInvite.data.inviteCode },
  });
  assert(Boolean(expiredRedeem.error), 'Expired invite codes are rejected');

  const revokedInvite = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
  });
  assert(!revokedInvite.error && typeof revokedInvite.data?.inviteCode === 'string',
    'Shop owner can create an invite for revocation testing');
  const revokedDigest = createHash('sha256').update(revokedInvite.data.inviteCode).digest('hex');
  const revokedRow = await must(admin.from('customer_link_invites').select('id')
    .eq('created_by', ownerA.id).eq('token_hash', `\\x${revokedDigest}`).single(),
    'find synthetic revocation-test invite');
  await must(admin.from('customer_link_invites').update({ revoked_at: new Date().toISOString() })
    .eq('id', revokedRow.id).select('id').single(), 'revoke synthetic invite');
  const revokedRedeem = await clientCustomer.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode: revokedInvite.data.inviteCode },
  });
  assert(Boolean(revokedRedeem.error), 'Revoked invite codes are rejected');

  // Two simultaneous redemption attempts for one invite must produce exactly one claim.
  const concurrentInvite = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
  });
  assert(!concurrentInvite.error && typeof concurrentInvite.data?.inviteCode === 'string',
    'Shop owner can create an invite for concurrent-redemption testing');
  // Use a fresh synthetic customer identity: the primary customer already
  // has a pending claim from the earlier single-redemption test, which would
  // make both concurrent requests fail before testing invite race behavior.
  const concurrentCustomer = await createUser('customer', '', 'concurrent-customer');
  const concurrentClient = await asUser(concurrentCustomer);
  const concurrentResults = await Promise.all([
    concurrentClient.functions.invoke('redeem-customer-link-invite', {
      body: { inviteCode: concurrentInvite.data.inviteCode },
    }),
    concurrentClient.functions.invoke('redeem-customer-link-invite', {
      body: { inviteCode: concurrentInvite.data.inviteCode },
    }),
  ]);
  const concurrentSuccesses = concurrentResults.filter((result) => !result.error && result.data?.status === 'pending').length;
  const concurrentFailures = concurrentResults.filter((result) => Boolean(result.error)).length;
  assert(concurrentSuccesses === 1 && concurrentFailures === 1,
    'Concurrent redemption allows exactly one successful request');
  const concurrentClaimCount = await admin.from('customer_link_claims')
    .select('id', { count: 'exact', head: true })
    .eq('invite_id', (await must(admin.from('customer_link_invites').select('id')
      .eq('created_by', ownerA.id)
      .eq('token_hash', `\\x${createHash('sha256').update(concurrentInvite.data.inviteCode).digest('hex')}`)
      .single(), 'find synthetic concurrent invite')).id);
  if (concurrentClaimCount.error) throw new Error(`count concurrent claims: ${concurrentClaimCount.error.message}`);
  assert(concurrentClaimCount.count === 1,
    'Concurrent redemption creates exactly one pending claim');

  const invalidRedeem = await clientCustomer.functions.invoke('redeem-customer-link-invite', {
    body: { inviteCode: 'not-a-valid-invite' },
  });
  assert(Boolean(invalidRedeem.error),
    'Malformed invite codes are rejected');

  const consentAttempt = await clientA.from('customer_consents').insert({
    shop_id: shopA, customer_id: customerA.id, purpose: 'automated-test-only',
    evidence_note: 'Synthetic test must be rejected', recorded_by: ownerA.id,
  });
  assert(Boolean(consentAttempt.error), 'Shop owner cannot write customer consent directly');

console.log(`RESULT: ${passed} security checks passed. Synthetic test accounts and records are retained in the isolated test project for review.`);
