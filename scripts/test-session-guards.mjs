import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDraftsForScope, isCurrentScope, shouldApplyInitialSession } from '../src/lib/sessionGuards.js';

test('late Account A response is rejected after switching to Account B', () => {
  const accountB = { demo: false, userId: 'user-b', shopId: 'shop-b' };
  const requestA = { userId: 'user-a', shopId: 'shop-a' };
  assert.equal(isCurrentScope(accountB, requestA), false);
  assert.equal(isCurrentScope(accountB, { userId: 'user-b', shopId: 'shop-b' }), true);
});

test('same user with a different shop is a different scope', () => {
  assert.equal(
    isCurrentScope({ demo: false, userId: 'user-a', shopId: 'shop-2' }, { userId: 'user-a', shopId: 'shop-1' }),
    false
  );
});

test('only drafts matching both userId and shopId are visible or eligible', () => {
  const drafts = [
    { id: '1', userId: 'a', shopId: 'x' },
    { id: '2', userId: 'a', shopId: 'y' },
    { id: '3', userId: 'b', shopId: 'x' },
    { id: '4', userId: 'b', shopId: 'y' }
  ];
  assert.deepEqual(filterDraftsForScope(drafts, 'a', 'x').map(d => d.id), ['1']);
  assert.deepEqual(filterDraftsForScope(drafts, 'b', 'y').map(d => d.id), ['4']);
  assert.deepEqual(filterDraftsForScope(drafts, '', 'x'), []);
});

test('a newer auth event prevents a stale getSession result from applying', () => {
  assert.equal(shouldApplyInitialSession(false), true);
  assert.equal(shouldApplyInitialSession(true), false);
});
