-- 011: atomic invite throttling, FK indexes, and RLS policy init-plan tuning.
-- Also replaces client-writable audit events with server-trigger-only inserts.

create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists customer_consents_recorded_by_idx on public.customer_consents(recorded_by);
create index if not exists customer_link_claims_reviewed_by_idx on public.customer_link_claims(reviewed_by);
create index if not exists customer_link_claims_shop_customer_idx on public.customer_link_claims(shop_id, customer_id);
create index if not exists customer_link_invites_created_by_idx on public.customer_link_invites(created_by);
create index if not exists customers_created_by_idx on public.customers(created_by);
create index if not exists ledger_entries_corrects_entry_id_idx on public.ledger_entries(corrects_entry_id);
create index if not exists ledger_entries_customer_id_idx on public.ledger_entries(customer_id);
create index if not exists payment_reminders_created_by_idx on public.payment_reminders(created_by);
create index if not exists shops_owner_id_idx on public.shops(owner_id);

-- Atomic per-owner invite creation. Advisory transaction lock prevents concurrent
-- requests from passing the hourly limit at the same time.
create or replace function public.create_customer_link_invite_atomic(
  p_shop_id uuid,
  p_customer_id uuid,
  p_created_by uuid,
  p_token_hash bytea,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_count integer;
begin
  if p_shop_id is null or p_customer_id is null or p_created_by is null
     or p_token_hash is null or octet_length(p_token_hash) <> 32
     or p_expires_at <= now() + interval '59 minutes'
     or p_expires_at > now() + interval '72 hours 1 minute' then
    raise exception 'Invitation cannot be created';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_created_by::text, 0));

  if not exists (
    select 1 from shops s
    where s.id = p_shop_id and s.owner_id = p_created_by
  ) or not exists (
    select 1 from customers c
    where c.id = p_customer_id and c.shop_id = p_shop_id
  ) then
    raise exception 'Invitation cannot be created';
  end if;

  select count(*) into invite_count
  from customer_link_invites
  where created_by = p_created_by
    and created_at >= now() - interval '1 hour';

  if invite_count >= 10 then
    raise exception 'INVITE_RATE_LIMIT';
  end if;

  insert into customer_link_invites
    (shop_id, customer_id, token_hash, created_by, expires_at)
  values
    (p_shop_id, p_customer_id, p_token_hash, p_created_by, p_expires_at);
end;
$$;

revoke all on function public.create_customer_link_invite_atomic(uuid, uuid, uuid, bytea, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_customer_link_invite_atomic(uuid, uuid, uuid, bytea, timestamptz)
  to service_role;

-- Avoid per-row repeated auth context lookups in RLS predicates.
drop policy if exists "profile owner can read own profile" on public.profiles;
create policy "profile owner can read own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profile owner can update own profile" on public.profiles;
create policy "profile owner can update own profile" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "shop owner can read own shops" on public.shops;
create policy "shop owner can read own shops" on public.shops
for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "shop owner can update own shop" on public.shops;
create policy "shop owner can update own shop" on public.shops
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "shop owner reads own customers" on public.customers;
create policy "shop owner reads own customers" on public.customers
for select to authenticated using ((select public.is_shop_owner(shop_id)));
drop policy if exists "shop owner adds own customers" on public.customers;
create policy "shop owner adds own customers" on public.customers
for insert to authenticated with check ((select public.is_shop_owner(shop_id)) and created_by = (select auth.uid()));
drop policy if exists "shop owner updates own customers" on public.customers;
create policy "shop owner updates own customers" on public.customers
for update to authenticated using ((select public.is_shop_owner(shop_id)))
with check ((select public.is_shop_owner(shop_id)) and created_by = (select auth.uid()));
drop policy if exists "shop owner deletes own customers" on public.customers;
create policy "shop owner deletes own customers" on public.customers
for delete to authenticated using ((select public.is_shop_owner(shop_id)));

drop policy if exists "shop owner reads own ledger" on public.ledger_entries;
create policy "shop owner reads own ledger" on public.ledger_entries
for select to authenticated using ((select public.is_shop_owner(shop_id)));
drop policy if exists "shop owner adds own ledger entries" on public.ledger_entries;
create policy "shop owner adds own ledger entries" on public.ledger_entries
for insert to authenticated with check (
  (select public.is_shop_owner(shop_id))
  and created_by = (select auth.uid())
  and exists (select 1 from public.customers c
    where c.id = ledger_entries.customer_id and c.shop_id = ledger_entries.shop_id)
);

drop policy if exists "shop owner reads own consent records" on public.customer_consents;
create policy "shop owner reads own consent records" on public.customer_consents
for select to authenticated using ((select public.is_shop_owner(shop_id)));
drop policy if exists "shop owner records consent evidence" on public.customer_consents;
create policy "shop owner records consent evidence" on public.customer_consents
for insert to authenticated with check (
  (select public.is_shop_owner(shop_id))
  and recorded_by = (select auth.uid())
  and exists (select 1 from public.customers c
    where c.id = customer_consents.customer_id and c.shop_id = customer_consents.shop_id)
);

drop policy if exists "shop owner reads own reminders" on public.payment_reminders;
create policy "shop owner reads own reminders" on public.payment_reminders
for select to authenticated using ((select public.is_shop_owner(shop_id)));
drop policy if exists "shop owner adds own reminders" on public.payment_reminders;
create policy "shop owner adds own reminders" on public.payment_reminders
for insert to authenticated with check (
  (select public.is_shop_owner(shop_id))
  and created_by = (select auth.uid())
  and exists (select 1 from public.customers c
    where c.id = payment_reminders.customer_id and c.shop_id = payment_reminders.shop_id)
);
drop policy if exists "shop owner updates own reminders" on public.payment_reminders;
create policy "shop owner updates own reminders" on public.payment_reminders
for update to authenticated using ((select public.is_shop_owner(shop_id)))
with check ((select public.is_shop_owner(shop_id)) and created_by = (select auth.uid()));

drop policy if exists "shop owner reads own audit events" on public.audit_events;
create policy "shop owner reads own audit events" on public.audit_events
for select to authenticated using ((select public.is_shop_owner(shop_id)));
drop policy if exists "shop owner records own audit events" on public.audit_events;
revoke insert on table public.audit_events from authenticated;
