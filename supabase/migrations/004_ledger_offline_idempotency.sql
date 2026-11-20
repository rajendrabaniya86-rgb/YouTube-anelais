-- Task 8: stable client reference for safe offline ledger retries.
-- Apply after migrations 001-003. Existing ledger rows remain valid with NULL client_ref.
alter table public.ledger_entries
  add column if not exists client_ref uuid;

create unique index if not exists ledger_shop_client_ref_uidx
  on public.ledger_entries(shop_id, client_ref)
  where client_ref is not null;

comment on column public.ledger_entries.client_ref is
  'Stable client-generated UUID used to make offline ledger retries idempotent.';
