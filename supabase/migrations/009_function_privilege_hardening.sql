-- 009: tighten function execution privileges and pin trigger search_path.
-- Trigger functions are not callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_account_type_change() from public, anon, authenticated;
revoke all on function public.prevent_immutable_record_changes() from public, anon, authenticated;

-- RLS policies call this helper for authenticated shop-owner checks.
revoke all on function public.is_shop_owner(uuid) from public, anon;
grant execute on function public.is_shop_owner(uuid) to authenticated, service_role;

-- Pin search_path for this trigger function to avoid object-shadowing risks.
alter function public.prevent_immutable_record_changes() set search_path = public;
