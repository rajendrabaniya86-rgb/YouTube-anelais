-- 013: remove SECURITY DEFINER from the exposed shop-ownership helper.
-- The helper reads shops through the caller's existing SELECT grant and RLS policy,
-- so elevated privileges are unnecessary.
create or replace function public.is_shop_owner(target_shop uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $ownership$
  select exists (
    select 1 from public.shops s
    where s.id = target_shop and s.owner_id = (select auth.uid())
  );
$ownership$;

revoke all on function public.is_shop_owner(uuid) from public, anon;
grant execute on function public.is_shop_owner(uuid) to authenticated, service_role;
