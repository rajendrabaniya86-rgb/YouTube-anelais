-- 019: keep privileged implementations out of the exposed public API schema.
-- Public RPCs are SECURITY INVOKER wrappers; private implementations validate auth.uid().

create index if not exists customer_ledger_access_events_shop_customer_idx
  on public.customer_ledger_access_events(shop_id, customer_id);

create or replace function private.get_my_approved_customer_claims()
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

create or replace function private.confirm_customer_ledger_access(p_claim_id uuid)
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

create or replace function private.revoke_customer_ledger_access(
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

create or replace function private.get_my_universal_ledger()
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

revoke all on function private.get_my_approved_customer_claims() from public, anon, authenticated;
revoke all on function private.confirm_customer_ledger_access(uuid) from public, anon, authenticated;
revoke all on function private.revoke_customer_ledger_access(uuid, uuid) from public, anon, authenticated;
revoke all on function private.get_my_universal_ledger() from public, anon, authenticated;
grant execute on function private.get_my_approved_customer_claims() to authenticated;
grant execute on function private.confirm_customer_ledger_access(uuid) to authenticated;
grant execute on function private.revoke_customer_ledger_access(uuid, uuid) to authenticated;
grant execute on function private.get_my_universal_ledger() to authenticated;

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
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.get_my_approved_customer_claims(); $$;

create or replace function public.confirm_customer_ledger_access(p_claim_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.confirm_customer_ledger_access(p_claim_id); $$;

create or replace function public.revoke_customer_ledger_access(p_shop_id uuid, p_customer_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.revoke_customer_ledger_access(p_shop_id, p_customer_id); $$;

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
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.get_my_universal_ledger(); $$;

revoke all on function public.get_my_approved_customer_claims() from public, anon;
revoke all on function public.confirm_customer_ledger_access(uuid) from public, anon;
revoke all on function public.revoke_customer_ledger_access(uuid, uuid) from public, anon;
revoke all on function public.get_my_universal_ledger() from public, anon;
grant execute on function public.get_my_approved_customer_claims() to authenticated;
grant execute on function public.confirm_customer_ledger_access(uuid) to authenticated;
grant execute on function public.revoke_customer_ledger_access(uuid, uuid) to authenticated;
grant execute on function public.get_my_universal_ledger() to authenticated;

comment on schema private is
  'Internal authorization functions for GTN. Public Data API wrappers use SECURITY INVOKER.';
