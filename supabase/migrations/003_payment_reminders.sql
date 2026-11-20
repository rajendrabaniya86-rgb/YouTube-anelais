-- Task 7: payment reminder records. Reminders are shop-private and are not sent automatically.
create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null,
  ledger_entry_id uuid,
  due_at timestamptz not null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint reminder_customer_shop_fk foreign key (shop_id,customer_id)
    references public.customers(shop_id,id) on delete restrict
);
create index if not exists reminders_shop_due_idx on public.payment_reminders(shop_id,due_at) where status='pending';
alter table public.payment_reminders enable row level security;
drop policy if exists "shop owner reads own reminders" on public.payment_reminders;
drop policy if exists "shop owner adds own reminders" on public.payment_reminders;
drop policy if exists "shop owner updates own reminders" on public.payment_reminders;
create policy "shop owner reads own reminders" on public.payment_reminders
for select to authenticated using (public.is_shop_owner(shop_id));
create policy "shop owner adds own reminders" on public.payment_reminders
for insert to authenticated with check (
  public.is_shop_owner(shop_id) and created_by=auth.uid()
  and exists(select 1 from public.customers c where c.id=customer_id and c.shop_id=payment_reminders.shop_id)
);
create policy "shop owner updates own reminders" on public.payment_reminders
for update to authenticated using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id) and created_by=auth.uid());
