-- Global Trust Network: initial tenant-isolated ledger schema.
-- Apply in Supabase SQL Editor. Review before production use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  shop_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  display_name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  entry_type text not null check (entry_type in ('credit', 'payment', 'reversal')),
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  corrects_entry_id uuid references public.ledger_entries(id) on delete restrict
);

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  purpose text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  evidence_note text not null default '',
  recorded_by uuid not null references public.profiles(id) on delete restrict
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists customers_shop_id_id_uidx on public.customers(shop_id,id);
create index if not exists customers_shop_idx on public.customers(shop_id);
create index if not exists ledger_shop_customer_time_idx on public.ledger_entries(shop_id, customer_id, created_at desc);
create index if not exists consents_customer_purpose_idx on public.customer_consents(customer_id, purpose);

create or replace function public.is_shop_owner(target_shop uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
    where s.id = target_shop and s.owner_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare new_shop_name text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  new_shop_name := nullif(trim(coalesce(new.raw_user_meta_data->>'shop_name', '')), '');
  if new_shop_name is not null then
    insert into public.shops (owner_id, shop_name) values (new.id, new_shop_name);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.customers enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.customer_consents enable row level security;
alter table public.audit_events enable row level security;

create policy "profile owner can read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "profile owner can update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "shop owner can read own shops" on public.shops
for select to authenticated using (owner_id = auth.uid());
create policy "shop owner can update own shop" on public.shops
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "shop owner manages own customers" on public.customers
for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id) and created_by = auth.uid());

create policy "shop owner reads own ledger" on public.ledger_entries
for select to authenticated using (public.is_shop_owner(shop_id));
create policy "shop owner adds own ledger entries" on public.ledger_entries
for insert to authenticated
with check (public.is_shop_owner(shop_id) and created_by = auth.uid());

create policy "shop owner reads own consent records" on public.customer_consents
for select to authenticated using (public.is_shop_owner(shop_id));
create policy "shop owner records consent evidence" on public.customer_consents
for insert to authenticated
with check (public.is_shop_owner(shop_id) and recorded_by = auth.uid());

create policy "shop owner reads own audit events" on public.audit_events
for select to authenticated using (public.is_shop_owner(shop_id));
create policy "shop owner records own audit events" on public.audit_events
for insert to authenticated
with check (public.is_shop_owner(shop_id) and actor_id = auth.uid());

-- Deliberately no UPDATE/DELETE policy for ledger entries or audit events:
-- corrections should be appended as reversal/correction records, preserving history.
