-- One-time customer-record invitation storage.
-- Raw invitation codes must never be stored. A trusted server function will
-- hash the code and use service-role access after verifying the shop owner.
-- No browser role receives access to this table.

create table if not exists public.customer_link_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  customer_id uuid not null,
  token_hash bytea not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  constraint customer_link_invites_token_hash_length
    check (octet_length(token_hash) = 32),
  constraint customer_link_invites_expiry
    check (expires_at > created_at),
  constraint customer_link_invites_terminal_state
    check (not (redeemed_at is not null and revoked_at is not null)),
  constraint customer_link_invites_shop_customer_fk
    foreign key (shop_id, customer_id)
    references public.customers(shop_id, id)
    on delete restrict
);

create unique index if not exists customer_link_invites_token_hash_uidx
  on public.customer_link_invites(token_hash);
create index if not exists customer_link_invites_active_customer_idx
  on public.customer_link_invites(shop_id, customer_id, expires_at)
  where redeemed_at is null and revoked_at is null;

alter table public.customer_link_invites enable row level security;

-- Explicitly deny browser access, including authenticated shop owners.
revoke all on table public.customer_link_invites from anon, authenticated;
grant all on table public.customer_link_invites to service_role;

comment on table public.customer_link_invites is
  'Hashed, expiring, single-use invitation codes. Access only through trusted server-side functions; never expose raw codes or ledger data.';
