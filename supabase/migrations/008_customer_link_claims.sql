-- Customer redemption creates a pending claim only. It never grants ledger access.
create table if not exists public.customer_link_claims (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique
    references public.customer_link_invites(id) on delete restrict,
  shop_id uuid not null,
  customer_id uuid not null,
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_note text not null default '',
  constraint customer_link_claims_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or
    (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint customer_link_claims_shop_customer_fk
    foreign key (shop_id, customer_id)
    references public.customers(shop_id, id)
    on delete restrict
);

create unique index if not exists customer_link_claims_one_pending_per_user_record
  on public.customer_link_claims(customer_user_id, customer_id)
  where status = 'pending';

alter table public.customer_link_claims enable row level security;
revoke all on table public.customer_link_claims from anon, authenticated;
grant all on table public.customer_link_claims to service_role;

-- Atomic redemption: lock the invite, verify expiry/state/account type, mark redeemed,
-- then create one pending claim in the same transaction.
create or replace function public.redeem_customer_link_invite(
  p_token_hash bytea,
  p_customer_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.customer_link_invites%rowtype;
  claim_id uuid;
  user_account_type text;
begin
  if p_token_hash is null or octet_length(p_token_hash) <> 32
     or p_customer_user_id is null then
    raise exception 'Invitation cannot be redeemed';
  end if;

  select p.account_type into user_account_type
  from public.profiles p
  where p.id = p_customer_user_id;

  if user_account_type is distinct from 'customer' then
    raise exception 'Invitation cannot be redeemed';
  end if;

  select * into invite_row
  from public.customer_link_invites
  where token_hash = p_token_hash
  for update;

  if not found
     or invite_row.redeemed_at is not null
     or invite_row.revoked_at is not null
     or invite_row.expires_at <= now() then
    raise exception 'Invitation cannot be redeemed';
  end if;

  if exists (
    select 1 from public.customer_link_claims c
    where c.customer_user_id = p_customer_user_id
      and c.customer_id = invite_row.customer_id
      and c.status = 'pending'
  ) then
    raise exception 'Invitation cannot be redeemed';
  end if;

  update public.customer_link_invites
  set redeemed_at = now()
  where id = invite_row.id;

  insert into public.customer_link_claims (
    invite_id, shop_id, customer_id, customer_user_id
  ) values (
    invite_row.id, invite_row.shop_id, invite_row.customer_id, p_customer_user_id
  )
  returning id into claim_id;

  return claim_id;
end;
$$;

revoke all on function public.redeem_customer_link_invite(bytea, uuid) from public, anon, authenticated;
grant execute on function public.redeem_customer_link_invite(bytea, uuid) to service_role;

comment on table public.customer_link_claims is
  'Private pending customer-record claims. A pending claim grants no ledger or balance access.';
