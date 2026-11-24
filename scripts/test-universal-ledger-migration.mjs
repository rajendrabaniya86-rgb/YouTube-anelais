import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/018_universal_identity_and_customer_ledger.sql', import.meta.url), 'utf8');

test('assigns each profile a permanent unique GTN ID', () => {
  assert.match(migration, /add column if not exists gtn_id text/i);
  assert.match(migration, /profiles_gtn_id_uidx/i);
  assert.match(migration, /alter column gtn_id set not null/i);
});

test('shop approval is not enough: customer must explicitly grant ledger access', () => {
  assert.match(migration, /get_my_approved_customer_claims/i);
  assert.match(migration, /confirm_customer_ledger_access/i);
  assert.match(migration, /c\.customer_user_id = v_actor_id/i);
  assert.match(migration, /c\.status = 'approved'/i);
  assert.match(migration, /customer_ledger_access_events/i);
});

test('universal ledger reads only active consent for the signed-in customer', () => {
  assert.match(migration, /get_my_universal_ledger/i);
  assert.match(migration, /a\.customer_user_id = v_actor_id/i);
  assert.match(migration, /a\.revoked_at is null/i);
  assert.match(migration, /join public\.ledger_entries le/i);
});

test('access tables are not directly readable or writable through the client API', () => {
  assert.match(migration, /revoke all on table public\.customer_ledger_access from public, anon, authenticated/i);
  assert.match(migration, /revoke all on table public\.customer_ledger_access_events from public, anon, authenticated/i);
  assert.match(migration, /using \(false\) with check \(false\)/i);
});

test('customers can revoke access and the audit trail remains append-only', () => {
  assert.match(migration, /revoke_customer_ledger_access/i);
  assert.match(migration, /action text not null check \(action in \('granted', 'revoked'\)\)/i);
});
