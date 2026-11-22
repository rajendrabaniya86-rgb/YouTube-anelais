import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import AuthGate from '../AuthGate.jsx';
import App from '../App.jsx';

const mocks = vi.hoisted(() => ({
  authListener: null,
  getSession: vi.fn(),
  signOut: vi.fn(),
  listCustomers: vi.fn(),
  listPaymentReminders: vi.fn(),
  listOfflineLedgerDrafts: vi.fn(),
  syncOfflineLedgerDraft: vi.fn(),
  removeOfflineLedgerDraft: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      onAuthStateChange: callback => {
        mocks.authListener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: mocks.getSession,
      signOut: mocks.signOut
    }
  }
}));

vi.mock('../lib/customerService', () => ({
  addCustomer: vi.fn(), listCustomers: mocks.listCustomers,
  addLedgerEntry: vi.fn(), listPaymentReminders: mocks.listPaymentReminders,
  addPaymentReminder: vi.fn(), updatePaymentReminder: vi.fn(),
  syncOfflineLedgerDraft: mocks.syncOfflineLedgerDraft,
  listPendingCustomerClaims: vi.fn(), reviewCustomerLinkClaim: vi.fn(),
  createCustomerLinkInvite: vi.fn(), redeemCustomerLinkInvite: vi.fn()
}));

vi.mock('../lib/offlineQueue', () => ({
  saveOfflineLedgerDraft: vi.fn(),
  listOfflineLedgerDrafts: mocks.listOfflineLedgerDrafts,
  removeOfflineLedgerDraft: mocks.removeOfflineLedgerDraft
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function customerData(userId, name) {
  return {
    shop: { id: 'shop-' + userId, shop_name: 'Shop ' + userId },
    customers: [{ id: 'customer-' + userId, display_name: name, phone: '' }],
    entries: []
  };
}

beforeEach(() => {
  mocks.authListener = null;
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.listPaymentReminders.mockResolvedValue([]);
  mocks.listOfflineLedgerDrafts.mockResolvedValue([]);
  mocks.removeOfflineLedgerDraft.mockResolvedValue(true);
});

afterEach(() => cleanup());

describe('session and account UI isolation', () => {
  it('clears the authenticated child after logout and returns to a clean login screen', async () => {
    render(<AuthGate><div data-testid="private-child">Private account screen</div></AuthGate>);
    await waitFor(() => expect(mocks.authListener).toBeTypeOf('function'));

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'old-account@example.test' } });
    await act(async () => {
      mocks.authListener('SIGNED_IN', {
        user: { id: 'user-a', email: 'old-account@example.test', user_metadata: { account_type: 'shop_owner' } }
      });
    });
    expect(screen.getByTestId('private-child')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'लॉग आउट' }));
    await waitFor(() => expect(screen.queryByTestId('private-child')).toBeNull());
    expect(screen.getByRole('heading', { name: 'अपने खाते में प्रवेश करें' })).toBeTruthy();
    expect(screen.getByPlaceholderText('you@example.com').value).toBe('');
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not render Account A data when its delayed request resolves after switching to Account B', async () => {
    const requestA = deferred();
    const requestB = deferred();
    mocks.listCustomers.mockImplementation(userId => userId === 'user-a' ? requestA.promise : requestB.promise);

    const view = render(<App mode="live" user={{ id: 'user-a', email: 'a@example.test' }} />);
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledWith('user-a'));

    view.rerender(<App mode="live" user={{ id: 'user-b', email: 'b@example.test' }} />);
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledWith('user-b'));
    expect(screen.queryByText('SECRET_ACCOUNT_A')).toBeNull();

    await act(async () => { requestA.resolve(customerData('user-a', 'SECRET_ACCOUNT_A')); });
    expect(screen.queryByText('SECRET_ACCOUNT_A')).toBeNull();

    await act(async () => { requestB.resolve(customerData('user-b', 'ACCOUNT_B_CUSTOMER')); });
    expect(await screen.findByText('ACCOUNT_B_CUSTOMER')).toBeTruthy();
    expect(screen.queryByText('SECRET_ACCOUNT_A')).toBeNull();
  });

  it('keeps an in-flight offline sync scoped to Account A after switching to Account B', async () => {
    const syncRequest = deferred();
    const draft = { id: 'draft-a', userId: 'user-a', shopId: 'shop-user-a', customerId: 'customer-user-a', type: 'credit', amount: 25, note: '', createdAt: new Date().toISOString() };
    mocks.listCustomers.mockImplementation(userId => Promise.resolve(customerData(userId, userId === 'user-a' ? 'ACCOUNT_A_CUSTOMER' : 'ACCOUNT_B_CUSTOMER')));
    mocks.listOfflineLedgerDrafts.mockImplementation(userId => Promise.resolve(userId === 'user-a' ? [draft] : []));
    mocks.syncOfflineLedgerDraft.mockReturnValue(syncRequest.promise);

    const view = render(<App mode="live" user={{ id: 'user-a', email: 'a@example.test' }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /ऑफलाइन ड्राफ्ट/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /ऑफलाइन ड्राफ्ट/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'सभी सिंक करें' }));
    await waitFor(() => expect(mocks.syncOfflineLedgerDraft).toHaveBeenCalledWith('shop-user-a', 'user-a', draft));

    view.rerender(<App mode="live" user={{ id: 'user-b', email: 'b@example.test' }} />);
    await act(async () => {
      syncRequest.resolve({ row: { id: 'ledger-a', customer_id: 'customer-user-a', entry_type: 'credit', amount: 25, created_at: new Date().toISOString() } });
    });

    expect(await screen.findByText('ACCOUNT_B_CUSTOMER')).toBeTruthy();
    expect(screen.queryByText('ACCOUNT_A_CUSTOMER')).toBeNull();
    expect(mocks.removeOfflineLedgerDraft).toHaveBeenCalledWith('draft-a', 'user-a', 'shop-user-a');
  });

});
