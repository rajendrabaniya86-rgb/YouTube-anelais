import assert from 'node:assert/strict';
import test from 'node:test';
import { syncOfflineLedgerDraftWithClient, syncOfflineLedgerDraftWithRetry } from '../src/lib/offlineLedgerSync.js';

const baseDraft = () => ({
  id: 'draft-0001', userId: 'user-A', shopId: 'shop-A',
  customerId: 'customer-A', type: 'credit', amount: 125.5, note: '  synthetic offline test  ',
});

function fakeClient({ insertError = null, lookupError = null, lookupOverride = undefined, transientErrorOnce = null } = {}) {
  const rows = [];
  let inserts = 0;
  return {
    rows,
    get inserts() { return inserts; },
    from(table) {
      assert.equal(table, 'ledger_entries');
      let payload = null;
      let filters = {};
      const query = {
        insert(value) { payload = value; return query; },
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        async single() {
          inserts += 1;
          if (insertError) return { data: null, error: insertError };
          if (transientErrorOnce && inserts === 1 && !transientErrorOnce.commitBeforeError) {
            return { data: null, error: transientErrorOnce.error };
          }
          if (rows.some(row => row.shop_id === payload.shop_id && row.client_ref === payload.client_ref)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          const row = { id: 'ledger-' + inserts, ...payload, created_at: '2026-11-22T00:00:00.000Z' };
          rows.push(row);
          if (transientErrorOnce && inserts === 1 && transientErrorOnce.commitBeforeError) {
            return { data: null, error: transientErrorOnce.error };
          }
          return { data: row, error: null };
        },
        async maybeSingle() {
          if (lookupError) return { data: null, error: lookupError };
          if (lookupOverride !== undefined) return { data: lookupOverride, error: null };
          return {
            data: rows.find(row => row.shop_id === filters.shop_id && row.client_ref === filters.client_ref) || null,
            error: null,
          };
        },
      };
      return query;
    },
  };
}

test('new offline draft inserts exactly one ledger row', async () => {
  const client = fakeClient();
  const result = await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', baseDraft());
  assert.equal(result.outcome, 'inserted');
  assert.equal(client.rows.length, 1);
  assert.equal(client.rows[0].amount, 125.5);
  assert.equal(client.rows[0].note, 'synthetic offline test');
  assert.equal(client.rows[0].client_ref, 'draft-0001');
});

test('retry after successful insert returns original row without a second insert', async () => {
  const client = fakeClient();
  const draft = baseDraft();
  const first = await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft);
  const retry = await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft);
  assert.equal(first.row.id, retry.row.id);
  assert.equal(retry.outcome, 'already_synced');
  assert.equal(client.rows.length, 1);
  assert.equal(client.inserts, 2);
});

test('concurrent duplicate requests settle on one row and one balance effect', async () => {
  const client = fakeClient();
  const draft = baseDraft();
  const results = await Promise.all([
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft),
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft),
  ]);
  assert.deepEqual(results.map(x => x.outcome).sort(), ['already_synced', 'inserted']);
  assert.equal(client.rows.length, 1);
  const balance = client.rows.reduce((sum, row) => sum + (row.entry_type === 'payment' ? -row.amount : row.amount), 0);
  assert.equal(balance, 125.5);
});

test('same draft ID with different payload is rejected and preserved for review', async () => {
  const client = fakeClient();
  const first = baseDraft();
  await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', first);
  const changed = { ...first, amount: 999 };
  await assert.rejects(
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', changed),
    /अलग लेन-देन में मिली/,
  );
  assert.equal(client.rows.length, 1);
});

test('account or shop scope mismatch is rejected before any database request', async () => {
  const client = fakeClient();
  await assert.rejects(syncOfflineLedgerDraftWithClient(client, 'shop-B', 'user-A', baseDraft()), /खाता मेल नहीं खाता/);
  assert.equal(client.inserts, 0);
});

test('invalid amount and transaction type are rejected before insert', async () => {
  const client = fakeClient();
  await assert.rejects(syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', { ...baseDraft(), amount: 0 }));
  await assert.rejects(syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', { ...baseDraft(), amount: 1.239 }));
  await assert.rejects(syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', { ...baseDraft(), type: 'refund' }));
  assert.equal(client.inserts, 0);
});

test('non-duplicate database errors are surfaced without retry lookup', async () => {
  const client = fakeClient({ insertError: { code: '08006', message: 'synthetic network failure' } });
  await assert.rejects(
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', baseDraft()),
    error => error?.code === '08006' && error?.message === 'synthetic network failure',
  );
  assert.equal(client.inserts, 1);
});

test('retry lookup errors are surfaced instead of deleting the offline draft', async () => {
  const client = fakeClient({
    insertError: { code: '23505', message: 'duplicate key' },
    lookupError: { code: '08006', message: 'synthetic lookup failure' },
  });
  const draft = baseDraft();
  await assert.rejects(
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft),
    error => error?.code === '08006' && error?.message === 'synthetic lookup failure',
  );
  assert.equal(client.rows.length, 0);
});

test('unique conflict without a matching stored row is not treated as success', async () => {
  const client = fakeClient({ insertError: { code: '23505', message: 'duplicate key' }, lookupOverride: null });
  await assert.rejects(syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', baseDraft()),
    error => error?.code === '23505' && error?.message === 'duplicate key');
});


test('manual retry succeeds after a transient network failure before commit', async () => {
  const client = fakeClient({
    transientErrorOnce: {
      commitBeforeError: false,
      error: { code: '08006', message: 'synthetic temporary network outage' },
    },
  });
  const draft = baseDraft();
  await assert.rejects(
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft),
    error => error?.code === '08006',
  );
  assert.equal(client.rows.length, 0, 'failed first attempt did not create a ledger row');

  const retry = await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft);
  assert.equal(retry.outcome, 'inserted');
  assert.equal(client.rows.length, 1, 'successful retry creates exactly one ledger row');
});

test('manual retry recognizes a committed row when the first response is lost', async () => {
  const client = fakeClient({
    transientErrorOnce: {
      commitBeforeError: true,
      error: { code: '08006', message: 'synthetic response lost after commit' },
    },
  });
  const draft = baseDraft();
  await assert.rejects(
    syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft),
    error => error?.code === '08006',
  );
  assert.equal(client.rows.length, 1, 'server-side commit exists despite lost response');

  const retry = await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft);
  assert.equal(retry.outcome, 'already_synced');
  assert.equal(retry.row.id, client.rows[0].id);
  assert.equal(client.rows.length, 1, 'retry does not create a duplicate ledger row');
});


test('bounded retry uses exponential backoff and succeeds after transient failures', async () => {
  const client = fakeClient({
    insertError: null,
    transientErrorOnce: { commitBeforeError: false, error: { code: '08006', message: 'temporary network failure' } },
  });
  // Make the fake return a transient error on its first insert only.
  const delays = [];
  const result = await syncOfflineLedgerDraftWithRetry(client, 'shop-A', 'user-A', baseDraft(), {
    maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100,
    sleep: async ms => { delays.push(ms); },
  });
  assert.equal(result.outcome, 'inserted');
  assert.equal(client.rows.length, 1);
  assert.deepEqual(delays, [10]);
});

test('retry wrapper recovers when server committed but response was lost', async () => {
  const client = fakeClient({
    transientErrorOnce: { commitBeforeError: true, error: { code: '08006', message: 'response lost after commit' } },
  });
  const delays = [];
  const result = await syncOfflineLedgerDraftWithRetry(client, 'shop-A', 'user-A', baseDraft(), {
    baseDelayMs: 5, sleep: async ms => { delays.push(ms); },
  });
  assert.equal(result.outcome, 'already_synced');
  assert.equal(client.rows.length, 1);
  assert.deepEqual(delays, [5]);
});

test('retry wrapper stops at configured attempt limit and exposes retry state', async () => {
  const client = fakeClient({ insertError: { code: '08006', message: 'persistent network outage' } });
  const delays = [];
  await assert.rejects(
    syncOfflineLedgerDraftWithRetry(client, 'shop-A', 'user-A', baseDraft(), {
      maxAttempts: 3, baseDelayMs: 7, maxDelayMs: 100,
      sleep: async ms => { delays.push(ms); },
    }),
    error => error?.retryExhausted === true && error?.retryAttempts === 3,
  );
  assert.equal(client.inserts, 3);
  assert.deepEqual(delays, [7, 14]);
});

test('authentication, permission, and validation failures are not retried', async () => {
  for (const error of [
    { code: '42501', message: 'permission denied' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: '22003', message: 'numeric value out of range' },
  ]) {
    const client = fakeClient({ insertError: error });
    await assert.rejects(
      syncOfflineLedgerDraftWithRetry(client, 'shop-A', 'user-A', baseDraft(), {
        maxAttempts: 4, sleep: async () => { throw new Error('must not retry'); },
      }),
      thrown => thrown === error || thrown?.code === error.code,
    );
    assert.equal(client.inserts, 1);
  }
});

test('duplicate client_ref is resolved idempotently without an extra retry delay', async () => {
  const client = fakeClient();
  const draft = baseDraft();
  await syncOfflineLedgerDraftWithClient(client, 'shop-A', 'user-A', draft);
  const delays = [];
  const result = await syncOfflineLedgerDraftWithRetry(client, 'shop-A', 'user-A', draft, {
    sleep: async ms => { delays.push(ms); },
  });
  assert.equal(result.outcome, 'already_synced');
  assert.equal(client.rows.length, 1);
  assert.deepEqual(delays, []);
});
