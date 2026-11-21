-- Protect the server-assigned account type from client-side profile edits.
-- Authenticated users may still update permitted profile fields such as full_name.
create or replace function public.prevent_account_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.account_type is distinct from old.account_type
     and auth.uid() is not null then
    raise exception 'account_type is managed by the trusted signup process';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_account_type on public.profiles;
create trigger protect_profile_account_type
before update on public.profiles
for each row execute function public.prevent_account_type_change();

-- The account type is not an identity check and grants no access by itself.
