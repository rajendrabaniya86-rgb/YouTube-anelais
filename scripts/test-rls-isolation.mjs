import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !secretKey || !publishableKey) {
  throw new Error('Missing required Supabase CI secrets.');
}

// Fail closed before constructing clients or performing any database operation.
// The expected ref is pinned in the workflow and must match the URL hostname.
const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
if (expectedProjectRef !== 'wlohqkgegsknygdxufie') {
  throw new Error('Supabase test-project allowlist is missing or invalid.');
}
let configuredProjectRef = '';
try {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') throw new Error('HTTPS required');
  configuredProjectRef = parsedUrl.hostname.split('.')[0];
} catch {
  throw new Error('SUPABASE_URL is invalid; refusing to run database tests.');
}
if (configuredProjectRef !== expectedProjectRef) {
  throw new Error('Supabase URL does not match the allowlisted synthetic test project; refusing all writes.');
}
const runId = process.env.TEST_RUN_ID || 'local';
if (!/^[a-zA-Z0-9._-]{1,100}$/.test(runId)) {
  throw new Error('TEST_RUN_ID contains unsupported characters.');
}
console.log(`Synthetic test target verified. Run ID: ${runId}`);

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = `${runId}-${randomBytes(4).toString('hex')}`;
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

  // Customer CRUD authorization matrix. These records are dedicated synthetic
  // fixtures so delete tests are not affected by invite/consent/ledger links.
  const crudCreate = await clientA.from('customers').insert({
    shop_id: shopA, display_name: `CRUD Own Customer ${tag}`,
    phone: null, notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
  }).select('id').single();
  if (crudCreate.error) throw new Error(`create own CRUD customer: ${crudCreate.error.message}`);
  const crudCustomerId = crudCreate.data.id;
  fixture.customerIds.push(crudCustomerId);
  assert(Boolean(crudCustomerId), 'Shop A can create a customer in its own shop');

  const wrongCreatorInsert = await clientA.from('customers').insert({
    shop_id: shopA, display_name: `CRUD Wrong Creator ${tag}`,
    notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerB.id,
  }).select('id');
  assert(Boolean(wrongCreatorInsert.error),
    'Customer INSERT rejects a created_by value belonging to another account');

  const crossShopInsert = await clientA.from('customers').insert({
    shop_id: shopB, display_name: `CRUD Cross Shop Insert ${tag}`,
    notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
  }).select('id');
  assert(Boolean(crossShopInsert.error),
    'Shop A cannot INSERT a customer into Shop B');

  const ownUpdate = await clientA.from('customers')
    .update({ display_name: `CRUD Own Customer Updated ${tag}` })
    .eq('id', crudCustomerId).select('id').maybeSingle();
  assert(!ownUpdate.error && ownUpdate.data?.id === crudCustomerId,
    'Shop A can UPDATE its own customer');

  const crossShopUpdate = await clientA.from('customers')
    .update({ display_name: `UNAUTHORIZED UPDATE ${tag}` })
    .eq('id', customerB.id).select('id');
  assert(!crossShopUpdate.error && crossShopUpdate.data.length === 0,
    'Shop A cannot UPDATE a Shop B customer');

  const crossShopDelete = await clientA.from('customers')
    .delete().eq('id', customerB.id).select('id');
  assert(!crossShopDelete.error && crossShopDelete.data.length === 0,
    'Shop A cannot DELETE a Shop B customer');

  const ownDelete = await clientA.from('customers')
    .delete().eq('id', crudCustomerId).select('id').maybeSingle();
  assert(!ownDelete.error && ownDelete.data?.id === crudCustomerId,
    'Shop A can DELETE its own customer when no dependent records exist');

  const ledgerProtectedDelete = await clientA.from('customers')
    .delete().eq('id', customerA.id).select('id');
  assert(Boolean(ledgerProtectedDelete.error),
    'Customer DELETE is blocked when ledger entries reference that customer');


  // Ledger arithmetic baseline: independent synthetic customer, exact
  // credit/payment sequence, and raw database sum after every transaction.
  const balanceCustomer = await must(admin.from('customers').insert({
    shop_id: shopA, display_name: `Synthetic Balance Customer ${tag}`,
    notes: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
  }).select('id').single(), 'create synthetic balance customer');
  fixture.customerIds.push(balanceCustomer.id);
  const balanceSteps = [
    { type: 'credit', amount: 1000, expected: 1000 },
    { type: 'payment', amount: 400, expected: 600 },
    { type: 'credit', amount: 500, expected: 1100 },
    { type: 'payment', amount: 1100, expected: 0 },
  ];
  let balanceEntryToProtect = null;
  for (const [index, step] of balanceSteps.entries()) {
    const inserted = await must(clientA.from('ledger_entries').insert({
      shop_id: shopA, customer_id: balanceCustomer.id,
      entry_type: step.type, amount: step.amount,
      note: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
    }).select('id').single(), `insert balance step ${index + 1}`);
    fixture.ledgerIds.push(inserted.id);
    if (index === 0) balanceEntryToProtect = inserted.id;

    const rawRows = await must(admin.from('ledger_entries')
      .select('entry_type, amount')
      .eq('shop_id', shopA).eq('customer_id', balanceCustomer.id),
      `read raw ledger after step ${index + 1}`);
    const rawBalance = rawRows.reduce((sum, row) => {
      const amount = Number(row.amount);
      return sum + (row.entry_type === 'payment' ? -amount : amount);
    }, 0);
    assert(Math.abs(rawBalance - step.expected) < 0.000001,
      `Raw ledger balance after step ${index + 1} equals ${step.expected}`);
  }
  const finalBalanceRows = await must(admin.from('ledger_entries')
    .select('entry_type, amount')
    .eq('shop_id', shopA).eq('customer_id', balanceCustomer.id),
    'read final synthetic balance ledger');
  const finalRawBalance = finalBalanceRows.reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (row.entry_type === 'payment' ? -amount : amount);
  }, 0);
  assert(finalRawBalance === 0,
    'Credit/payment sequence 0 → +1000 → +600 → +1100 → 0 finishes at zero');

  // Authenticated ledger rows are append-only: UPDATE/DELETE should affect
  // zero rows, and the original entry must remain unchanged.
  const attemptedLedgerUpdate = await clientA.from('ledger_entries')
    .update({ amount: 9999, note: 'UNAUTHORIZED MUTATION' })
    .eq('id', balanceEntryToProtect).select('id');
  assert(
    Boolean(attemptedLedgerUpdate.error) ||
      (Array.isArray(attemptedLedgerUpdate.data) && attemptedLedgerUpdate.data.length === 0),
    'Authenticated owner cannot UPDATE an existing ledger entry (denied or zero rows)',
  );

  const attemptedLedgerDelete = await clientA.from('ledger_entries')
    .delete().eq('id', balanceEntryToProtect).select('id');
  assert(
    Boolean(attemptedLedgerDelete.error) ||
      (Array.isArray(attemptedLedgerDelete.data) && attemptedLedgerDelete.data.length === 0),
    'Authenticated owner cannot DELETE an existing ledger entry (denied or zero rows)',
  );

  const protectedLedgerRow = await must(admin.from('ledger_entries')
    .select('amount, note').eq('id', balanceEntryToProtect).single(),
    'verify protected ledger entry remains unchanged');
  assert(Number(protectedLedgerRow.amount) === 1000 &&
    protectedLedgerRow.note === 'AUTOMATED TEST FIXTURE ONLY',
    'Ledger entry values remain unchanged after UPDATE/DELETE attempts');


  // Offline ledger idempotency: sequential duplicate, concurrent race, and
  // retry lookup are tested with independent synthetic customer records.
  const sequentialClientRef = randomUUID();
  const sequentialPayload = {
    shop_id: shopA, customer_id: balanceCustomer.id, created_by: ownerA.id,
    entry_type: 'credit', amount: 125, note: 'SYNTHETIC IDEMPOTENCY TEST',
    client_ref: sequentialClientRef,
  };
  const firstSequential = await must(clientA.from('ledger_entries')
    .insert(sequentialPayload).select('id,shop_id,customer_id,entry_type,amount,note,created_by,client_ref').single(),
    'insert first sequential client_ref ledger row');
  fixture.ledgerIds.push(firstSequential.id);
  const duplicateSequential = await clientA.from('ledger_entries')
    .insert(sequentialPayload).select('id');
  assert(duplicateSequential.error?.code === '23505',
    'Sequential duplicate client_ref is rejected by the unique index');
  const sequentialExisting = await must(clientA.from('ledger_entries')
    .select('id,shop_id,customer_id,entry_type,amount,note,created_by,client_ref')
    .eq('shop_id', shopA).eq('client_ref', sequentialClientRef).maybeSingle(),
    'lookup existing sequential client_ref row');
  assert(sequentialExisting?.id === firstSequential.id &&
    sequentialExisting.customer_id === sequentialPayload.customer_id &&
    sequentialExisting.created_by === ownerA.id &&
    sequentialExisting.entry_type === sequentialPayload.entry_type &&
    Number(sequentialExisting.amount) === sequentialPayload.amount &&
    sequentialExisting.note === sequentialPayload.note,
    'Sequential retry lookup returns the original matching ledger row');
  const sequentialCountRows = await must(admin.from('ledger_entries')
    .select('id').eq('shop_id', shopA).eq('client_ref', sequentialClientRef),
    'count sequential client_ref rows');
  assert(sequentialCountRows.length === 1,
    'Sequential duplicate client_ref leaves exactly one ledger row');

  const concurrentClientRef = randomUUID();
  const concurrentPayload = {
    ...sequentialPayload, client_ref: concurrentClientRef,
    entry_type: 'payment', amount: 30, note: 'SYNTHETIC CONCURRENT RETRY TEST',
  };
  const concurrentResults = await Promise.all([
    clientA.from('ledger_entries').insert(concurrentPayload).select('id').single(),
    clientA.from('ledger_entries').insert(concurrentPayload).select('id').single(),
  ]);
  const concurrentSuccesses = concurrentResults.filter(result => !result.error && result.data?.id);
  const concurrentConflicts = concurrentResults.filter(result => result.error?.code === '23505');
  assert(concurrentSuccesses.length === 1 && concurrentConflicts.length === 1,
    'Concurrent identical client_ref requests produce one insert and one unique conflict');
  const concurrentRows = await must(admin.from('ledger_entries')
    .select('id,shop_id,customer_id,entry_type,amount,note,created_by,client_ref')
    .eq('shop_id', shopA).eq('client_ref', concurrentClientRef),
    'read concurrent client_ref rows');
  if (concurrentRows[0]?.id) fixture.ledgerIds.push(concurrentRows[0].id);
  assert(concurrentRows.length === 1,
    'Concurrent identical client_ref requests leave exactly one ledger row');
  const concurrentRetry = concurrentRows[0];
  assert(Boolean(concurrentRetry) &&
    concurrentRetry.customer_id === concurrentPayload.customer_id &&
    concurrentRetry.created_by === ownerA.id &&
    concurrentRetry.entry_type === concurrentPayload.entry_type &&
    Number(concurrentRetry.amount) === concurrentPayload.amount &&
    concurrentRetry.note === concurrentPayload.note,
    'Concurrent retry can retrieve the original matching ledger row');
  const idempotentBalanceRows = await must(admin.from('ledger_entries')
    .select('entry_type,amount').eq('shop_id', shopA)
    .eq('customer_id', balanceCustomer.id),
    'read balance after idempotency tests');
  const idempotentBalance = idempotentBalanceRows.reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (row.entry_type === 'payment' ? -amount : amount);
  }, 0);
  assert(idempotentBalance === 95,
    'Duplicate retries affect the synthetic customer balance only once per client_ref');

  const crossShopUpdateCheck = await visibleIds(clientB, 'customers', customerB.id);
  assert(crossShopUpdateCheck.length === 1,
    'Shop B customer remains present after Shop A cross-shop UPDATE/DELETE attempts');

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

  // Composite foreign keys must prevent cross-customer references even
  // if an application request accidentally supplies another tenant's IDs.
  const crossTenantCorrection = await clientA.from('ledger_entries').insert({
    shop_id: shopA, customer_id: customerA.id, entry_type: 'credit', amount: 3,
    note: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
    corrects_entry_id: ledgerB.id,
  });
  assert(Boolean(crossTenantCorrection.error),
    'Ledger correction cannot reference another shop/customer ledger entry');

  const crossTenantReminder = await clientA.from('payment_reminders').insert({
    shop_id: shopA, customer_id: customerA.id, ledger_entry_id: ledgerB.id,
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    message: 'AUTOMATED TEST FIXTURE ONLY', created_by: ownerA.id,
  });
  assert(Boolean(crossTenantReminder.error),
    'Payment reminder cannot reference another shop/customer ledger entry');

  const consentAttempt = await clientA.from('customer_consents').insert({
    shop_id: shopA, customer_id: customerA.id, purpose: 'automated-test-only',
    evidence_note: 'Synthetic test must be rejected', recorded_by: ownerA.id,
  });
  assert(Boolean(consentAttempt.error), 'Shop owner cannot write customer consent directly');

// Atomic invite rate-limit boundary: the RPC already enforces 10 invites
// per owner per rolling hour under an advisory transaction lock.
const inviteCountBeforeRateTest = await admin.from('customer_link_invites')
  .select('id', { count: 'exact', head: true })
  .eq('created_by', ownerA.id)
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
if (inviteCountBeforeRateTest.error) throw new Error(`count rate-limit fixtures: ${inviteCountBeforeRateTest.error.message}`);
if (inviteCountBeforeRateTest.count > 10) throw new Error('Unexpected invite fixture count exceeds configured rate limit.');
for (let i = inviteCountBeforeRateTest.count; i < 10; i += 1) {
  const fillInvite = await clientA.functions.invoke('create-customer-link-invite', {
    body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
  });
  if (fillInvite.error || typeof fillInvite.data?.inviteCode !== 'string') {
    throw new Error(`Could not fill synthetic invite quota at slot ${i + 1}: ${fillInvite.error?.message ?? 'missing invite code'}`);
  }
}
const rateLimitedInvite = await clientA.functions.invoke('create-customer-link-invite', {
  body: { shopId: shopA, customerId: customerA.id, expiresInHours: 1 },
});
assert(Boolean(rateLimitedInvite.error), '11th invite within one hour is rate-limited for the same shop owner');

console.log(`RESULT: ${passed} security checks passed. Synthetic test accounts and records are retained in the isolated test project for review.`);
