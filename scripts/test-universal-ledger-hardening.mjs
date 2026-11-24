import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/019_private_ledger_rpc_hardening.sql', import.meta.url), 'utf8');

test('privileged implementations live in the non-exposed private schema', () => {
  for (const name of ['get_my_approved_customer_claims','confirm_customer_ledger_access','revoke_customer_ledger_access','get_my_universal_ledger']) {
    assert.match(migration, new RegExp('create or replace function private\\.' + name, 'i'));
  }
});

test('public RPC entry points are security-invoker wrappers', () => {
  const wrappers = migration.split('create or replace function public.').slice(1);
  assert.equal(wrappers.length, 4);
  for (const wrapper of wrappers) {
    assert.match(wrapper, /security invoker/i);
    assert.doesNotMatch(wrapper.split('$$;')[0], /security definer/i);
  }
});

test('only authenticated callers can execute the wrappers and private functions', () => {
  assert.match(migration, /revoke all on function private\.get_my_universal_ledger\(\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function private\.get_my_universal_ledger\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_my_universal_ledger\(\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.get_my_universal_ledger\(\) to authenticated/i);
});

test('adds an index covering the access-event shop/customer foreign key', () => {
  assert.match(migration, /customer_ledger_access_events_shop_customer_idx/i);
});
