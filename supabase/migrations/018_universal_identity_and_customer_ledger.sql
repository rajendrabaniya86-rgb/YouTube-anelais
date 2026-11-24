-- 018: permanent GTN identity and customer-consented cross-shop ledger.
-- This is an internal record/ledger feature only. It does not move, hold, or transfer money.
-- A shopkeeper's approval of a link claim is NOT customer consent. The customer must confirm separately.

alter table public.profiles
  add column if not exists gtn_id text;

update public.profiles
   set gtn_id = 'GTN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
 where gtn_id is null;

alter table public.profiles
  alter column gtn_id set default ('GTN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

alter table public.profiles
  alter column gtn_id set not null;

create unique index if not exists profiles_gtn_id_uidx
  on public.profiles(gtn_id);

comment on column public.profiles.gtn_id is
  'Permanent GTN identifier. It is not a password, payment credential, or proof of legal identity.';

create table if not exists public.customer_ledger_access (
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null,
  granted_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  primary key (customer_user_id, shop_id, customer_id),
  constraint customer_ledger_access_shop_customer_fk
    foreign key (shop_id, customer_id)
    references public.customers(shop_id, id)
    on delete restrict,
  constraint customer_ledger_access_revocation_order
    check (revoked_at is null or revoked_at >= granted_at)
);

-- A shop customer record can be actively linked to only one GTN customer account.
create unique index if not exists customer_ledger_access_one_active_user_uidx
  on public.customer_ledger_access(shop_id, customer_id)
  where revoked_at is null;

create table if not exists public.customer_ledger_access_events (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null,
  action text not null check (action in ('granted', 'revoked')),
  created_at timestamptz not null default clock_timestamp(),
  constraint customer_ledger_access_events_shop_customer_fk
    foreign key (shop_id, customer_id)
    references public.customers(shop_id, id)
    on delete restrict
);

create index if not exists customer_ledger_access_events_lookup_idx
  on public.customer_ledger_access_events(customer_user_id, created_at desc);

alter table public.customer_ledger_access enable row level security;
alter table public.customer_ledger_access_events enable row level security;

revoke all on table public.customer_ledger_access from public, anon, authenticated;
revoke all on table public.customer_ledger_access_events from public, anon, authenticated;

create policy "deny direct api access"
  on public.customer_ledger_access
  for all to anon, authenticated
  using (false) with check (false);

create policy "deny direct api access"
  on public.customer_ledger_access_events
  for all to anon, authenticated
  using (false) with check (false);

-- Return only approved link claims belonging to the currently authenticated customer.
-- No ledger data is returned until the customer separately confirms access.
create or replace function public.get_my_approved_customer_claims()
returns table (
  claim_id uuid,
  shop_id uuid,
  shop_name text,
  customer_id uuid,
  customer_name text,
  submitted_at timestamptz,
  ledger_access_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select c.id, c.shop_id, s.shop_name, c.customer_id, cu.display_name,
         c.submitted_at,
         exists (
           select 1
             from public.customer_ledger_access a
            where a.customer_user_id = v_actor_id
              and a.shop_id = c.shop_id
              and a.customer_id = c.customer_id
              and a.revoked_at is null
         )
    from public.customer_link_claims c
    join public.shops s on s.id = c.shop_id
    join public.customers cu on cu.id = c.customer_id and cu.shop_id = c.shop_id
    join public.profiles p on p.id = v_actor_id and p.account_type = 'customer'
   where c.customer_user_id = v_actor_id
     and c.status = 'approved'
   order by c.submitted_at desc;
end;
$$;

revoke all on function public.get_my_approved_customer_claims() from public, anon;
grant execute on function public.get_my_approved_customer_claims() to authenticated;

-- Customer-only consent. Shop-owner approval by itself never creates ledger access.
create or replace function public.confirm_customer_ledger_access(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_claim public.customer_link_claims%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;
  if p_claim_id is null then
    raise exception 'Invalid claim';
  end if;

  select c.*
    into v_claim
    from public.customer_link_claims c
    join public.profiles p on p.id = v_actor_id and p.account_type = 'customer'
   where c.id = p_claim_id
     and c.customer_user_id = v_actor_id
     and c.status = 'approved'
   for update of c;

  if not found then
    raise exception 'Approved customer request not found';
  end if;

  insert into public.customer_ledger_access (
    customer_user_id, shop_id, customer_id, granted_at, revoked_at
  ) values (
    v_actor_id, v_claim.shop_id, v_claim.customer_id, v_now, null
  )
  on conflict (customer_user_id, shop_id, customer_id)
  do update set granted_at = excluded.granted_at, revoked_at = null;

  insert into public.customer_ledger_access_events (
    customer_user_id, shop_id, customer_id, action, created_at
  ) values (v_actor_id, v_claim.shop_id, v_claim.customer_id, 'granted', v_now);

  return jsonb_build_object(
    'success', true,
    'ledger_access_granted', true,
    'shop_id', v_claim.shop_id,
    'customer_id', v_claim.customer_id,
    'granted_at', v_now
  );
end;
$$;

revoke all on function public.confirm_customer_ledger_access(uuid) from public, anon;
grant execute on function public.confirm_customer_ledger_access(uuid) to authenticated;

-- Customer can revoke access at any time. The historical events remain append-only.
create or replace function public.revoke_customer_ledger_access(
  p_shop_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;
  if p_shop_id is null or p_customer_id is null then
    raise exception 'Invalid ledger link';
  end if;

  update public.customer_ledger_access a
     set revoked_at = v_now
   where a.customer_user_id = v_actor_id
     and a.shop_id = p_shop_id
     and a.customer_id = p_customer_id
     and a.revoked_at is null;

  if not found then
    raise exception 'Active ledger access not found';
  end if;

  insert into public.customer_ledger_access_events (
    customer_user_id, shop_id, customer_id, action, created_at
  ) values (v_actor_id, p_shop_id, p_customer_id, 'revoked', v_now);

  return jsonb_build_object(
    'success', true,
    'ledger_access_revoked', true,
    'shop_id', p_shop_id,
    'customer_id', p_customer_id,
    'revoked_at', v_now
  );
end;
$$;

revoke all on function public.revoke_customer_ledger_access(uuid, uuid) from public, anon;
grant execute on function public.revoke_customer_ledger_access(uuid, uuid) to authenticated;

-- One read path for the customer's complete consented history across participating shops.
-- It returns only rows covered by a live, customer-granted access record.
create or replace function public.get_my_universal_ledger()
returns table (
  gtn_id text,
  shop_id uuid,
  shop_name text,
  customer_id uuid,
  customer_name text,
  entry_id uuid,
  entry_type text,
  amount numeric,
  note text,
  corrects_entry_id uuid,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select p.gtn_id, s.id, s.shop_name, cu.id, cu.display_name,
         le.id, le.entry_type, le.amount, le.note, le.corrects_entry_id, le.created_at
    from public.customer_ledger_access a
    join public.profiles p on p.id = a.customer_user_id
    join public.shops s on s.id = a.shop_id
    join public.customers cu on cu.id = a.customer_id and cu.shop_id = a.shop_id
    join public.ledger_entries le on le.shop_id = a.shop_id and le.customer_id = a.customer_id
   where a.customer_user_id = v_actor_id
     and a.revoked_at is null
   order by le.created_at desc;
end;
$$;

revoke all on function public.get_my_universal_ledger() from public, anon;
grant execute on function public.get_my_universal_ledger() to authenticated;

comment on table public.customer_ledger_access is
  'Customer-controlled, revocable permission to view one verified shop-customer ledger.';
comment on table public.customer_ledger_access_events is
  'Append-only audit history for customer ledger-access grants and revocations.';
comment on function public.get_my_universal_ledger() is
  'Returns only the authenticated customer account records from shops where that customer explicitly granted ledger access. No bank balance or money custody is provided.';
