-- 014: no shopkeeper may create or alter a customer's consent record.
-- Consent recording stays disabled until a customer-authenticated consent flow exists.
drop policy if exists "shop owner records consent evidence" on public.customer_consents;
revoke insert, update, delete on table public.customer_consents from authenticated;
