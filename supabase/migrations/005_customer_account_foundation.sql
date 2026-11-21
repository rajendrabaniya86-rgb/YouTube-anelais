-- Customer account foundation. Account type is a UI classification only;
-- never use user-editable auth metadata as an authorization decision.
alter table public.profiles
  add column if not exists account_type text not null default 'shop_owner'
  check (account_type in ('shop_owner','customer'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  new_shop_name text;
  new_account_type text;
begin
  new_account_type := case
    when new.raw_user_meta_data->>'account_type' = 'customer' then 'customer'
    else 'shop_owner'
  end;

  insert into public.profiles (id, full_name, account_type)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new_account_type)
  on conflict (id) do nothing;

  new_shop_name := nullif(trim(coalesce(new.raw_user_meta_data->>'shop_name', '')), '');
  if new_account_type = 'shop_owner' and new_shop_name is not null then
    insert into public.shops (owner_id, shop_name) values (new.id, new_shop_name);
  end if;
  return new;
end;
$$;

-- No customer-record links or cross-shop read permissions are created here.
-- A separate verification and consent workflow is required before any sharing.
