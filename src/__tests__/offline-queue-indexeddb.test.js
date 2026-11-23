import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveOfflineLedgerDraft,
  listOfflineLedgerDrafts,
  removeOfflineLedgerDraft,
} from '../lib/offlineQueue.js';

let nextId = 0;

beforeEach(async () => {
  nextId = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `offline-test-${++nextId}`,
  });
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('global-trust-offline');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion blocked in test'));
  });
});

describe('IndexedDB offline ledger queue', () => {
  it('saves a pending draft and returns it only for its exact user and shop', async () => {
    const draft = await saveOfflineLedgerDraft({
      userId: 'user-a',
      shopId: 'shop-a',
      customerId: 'customer-a',
      type: 'credit',
      amount: 125.5,
      note: '  offline note  ',
    });

    expect(draft).toMatchObject({
      id: 'offline-test-1',
      userId: 'user-a',
      shopId: 'shop-a',
      customerId: 'customer-a',
      type: 'credit',
      amount: 125.5,
      note: '  offline note  ',
      state: 'pending',
    });
    expect(await listOfflineLedgerDrafts('user-a', 'shop-a')).toHaveLength(1);
    expect(await listOfflineLedgerDrafts('user-b', 'shop-a')).toEqual([]);
    expect(await listOfflineLedgerDrafts('user-a', 'shop-b')).toEqual([]);
  });

  it('keeps drafts ordered by creation time', async () => {
    await saveOfflineLedgerDraft({
      userId: 'user-a', shopId: 'shop-a', customerId: 'customer-a',
      type: 'credit', amount: 10,
    });
    await new Promise(resolve => setTimeout(resolve, 2));
    await saveOfflineLedgerDraft({
      userId: 'user-a', shopId: 'shop-a', customerId: 'customer-a',
      type: 'payment', amount: 5,
    });

    const drafts = await listOfflineLedgerDrafts('user-a', 'shop-a');
    expect(drafts).toHaveLength(2);
    expect(drafts[0].type).toBe('credit');
    expect(drafts[1].type).toBe('payment');
  });

  it('does not let another user or shop delete a draft', async () => {
    const draft = await saveOfflineLedgerDraft({
      userId: 'user-a', shopId: 'shop-a', customerId: 'customer-a',
      type: 'credit', amount: 20,
    });

    expect(await removeOfflineLedgerDraft(draft.id, 'user-b', 'shop-a')).toBe(false);
    expect(await removeOfflineLedgerDraft(draft.id, 'user-a', 'shop-b')).toBe(false);
    expect(await listOfflineLedgerDrafts('user-a', 'shop-a')).toHaveLength(1);
    expect(await removeOfflineLedgerDraft(draft.id, 'user-a', 'shop-a')).toBe(true);
    expect(await listOfflineLedgerDrafts('user-a', 'shop-a')).toEqual([]);
  });

  it('rejects invalid amounts, precision, scope, and transaction types', async () => {
    const valid = {
      userId: 'user-a', shopId: 'shop-a', customerId: 'customer-a',
      type: 'credit', amount: 10,
    };
    await expect(saveOfflineLedgerDraft({ ...valid, amount: 0 })).rejects.toThrow();
    await expect(saveOfflineLedgerDraft({ ...valid, amount: 1.239 })).rejects.toThrow();
    await expect(saveOfflineLedgerDraft({ ...valid, userId: '' })).rejects.toThrow();
    await expect(saveOfflineLedgerDraft({ ...valid, type: 'refund' })).rejects.toThrow();
    expect(await listOfflineLedgerDrafts('', 'shop-a')).toEqual([]);
  });
});
