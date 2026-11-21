-- 012: cover the payment reminder composite customer/shop foreign key.
create index if not exists payment_reminders_shop_customer_idx
  on public.payment_reminders(shop_id, customer_id);
