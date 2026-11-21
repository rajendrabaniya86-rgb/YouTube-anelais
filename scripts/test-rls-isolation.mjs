import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

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
async function createUser(role, shopName = '') {
  const email = `gtn-${tag}-${role}@example.com`;
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
async function cleanup() {
  // Delete only records created by this run, in FK-safe order.
  if (fixture.auditIds.length) await admin.from('audit_events').delete().in('id', fixture.auditIds);
  if (fixture.ledgerIds.length) await admin.from('ledger_entries').delete().in('id', fixture.ledgerIds);
  if (fixture.customerIds.length) await admin.from('customers').delete().in('id', fixture.customerIds);
  if (fixture.shopIds.length) await admin.from('shops').delete().in('id', fixture.shopIds);
  for (const id of createdUsers.reverse()) await admin.auth.admin.deleteUser(id);
}

try {
  const ownerA = await createUser('shop_owner', `Synthetic Shop A ${tag}`);
  const ownerB = await createUser('shop_owner', `Synthetic Shop B ${tag}`);
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

  const consentAttempt = await clientA.from('customer_consents').insert({
    shop_id: shopA, customer_id: customerA.id, purpose: 'automated-test-only',
    evidence_note: 'Synthetic test must be rejected', recorded_by: ownerA.id,
  });
  assert(Boolean(consentAttempt.error), 'Shop owner cannot write customer consent directly');

  console.log(`RESULT: ${passed} security checks passed.`);
} finally {
  await cleanup();
}
