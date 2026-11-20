-- Global Trust Network security hardening migration (task 6).
-- Safe to apply after 001_initial_schema.sql. Review with an adult/legal/security reviewer before production.

-- Replace the malformed customer policy with explicit shop-scoped policies.
drop policy if exists "shop owner manages own customers" on public.customers;
drop policy if exists "shop owner reads own customers" on public.customers;
drop policy if exists "shop owner adds own customers" on public.customers;
drop policy if exists "shop owner updates own customers" on public.customers;
drop policy if exists "shop owner deletes own customers" on public.customers;

create policy "shop owner reads own customers" on public.customers
for select to authenticated using (public.is_shop_owner(shop_id));
create policy "shop owner adds own customers" on public.customers
for insert to authenticated with check (public.is_shop_owner(shop_id) and created_by = auth.uid());
create policy "shop owner updates own customers" on public.customers
for update to authenticated using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id) and created_by = auth.uid());
create policy "shop owner deletes own customers" on public.customers
for delete to authenticated using (public.is_shop_owner(shop_id));

-- A ledger row must point to a customer belonging to the same shop.
drop policy if exists "shop owner adds own ledger entries" on public.ledger_entries;
create policy "shop owner adds own ledger entries" on public.ledger_entries
for insert to authenticated
with check (
  public.is_shop_owner(shop_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.customers c
    where c.id = customer_id and c.shop_id = ledger_entries.shop_id
  )
);

-- Consent evidence must also belong to a customer in that same shop.
drop policy if exists "shop owner records consent evidence" on public.customer_consents;
create policy "shop owner records consent evidence" on public.customer_consents
for insert to authenticated
with check (
  public.is_shop_owner(shop_id)
  and recorded_by = auth.uid()
  and exists (
    select 1 from public.customers c
    where c.id = customer_id and c.shop_id = customer_consents.shop_id
  )
);

-- Prevent accidental editing/deletion of financial history and audit records.
create or replace function public.prevent_immutable_record_changes()
returns trigger language plpgsql
as $$
begin
  raise exception 'This history is append-only. Add a correcting or reversal record instead.';
end;
$$;

drop trigger if exists ledger_entries_immutable on public.ledger_entries;
create trigger ledger_entries_immutable
before update or delete on public.ledger_entries
for each row execute function public.prevent_immutable_record_changes();

drop trigger if exists audit_events_immutable on public.audit_events;
create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.prevent_immutable_record_changes();

-- Keep tenant/customer relationship consistent even if future code changes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ledger_customer_shop_fk') then
    alter table public.ledger_entries
      add constraint ledger_customer_shop_fk
      foreign key (shop_id, customer_id)
      references public.customers(shop_id, id)
      on delete restrict;
  end if;
end $$;

create index if not exists ledger_created_by_idx on public.ledger_entries(created_by);
create index if not exists audit_shop_time_idx on public.audit_events(shop_id, created_at desc);
create index if not exists consents_shop_customer_idx on public.customer_consents(shop_id, customer_id);
