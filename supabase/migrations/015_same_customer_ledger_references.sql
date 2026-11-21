-- 015: enforce same-shop and same-customer ledger references.
-- Prevents corrections and payment reminders from pointing at another customer's ledger row.
alter table public.ledger_entries
  add constraint ledger_entries_id_shop_customer_uk unique (id, shop_id, customer_id);

alter table public.ledger_entries
  drop constraint if exists ledger_entries_corrects_entry_id_fkey;

alter table public.ledger_entries
  add constraint ledger_entries_corrects_same_customer_fk
  foreign key (corrects_entry_id, shop_id, customer_id)
  references public.ledger_entries(id, shop_id, customer_id)
  on delete restrict;

alter table public.payment_reminders
  add constraint payment_reminders_ledger_same_customer_fk
  foreign key (ledger_entry_id, shop_id, customer_id)
  references public.ledger_entries(id, shop_id, customer_id)
  on delete restrict;

create index if not exists ledger_entries_corrects_same_customer_idx
  on public.ledger_entries(corrects_entry_id, shop_id, customer_id)
  where corrects_entry_id is not null;

create index if not exists payment_reminders_ledger_same_customer_idx
  on public.payment_reminders(ledger_entry_id, shop_id, customer_id)
  where ledger_entry_id is not null;
