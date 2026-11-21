-- 016: shop-owner claim review. Approval is not customer consent and never grants ledger access.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.review_customer_link_claim(
  p_claim_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  claim_row public.customer_link_claims%rowtype;
  clean_note text;
  reviewed_time timestamptz;
begin
  actor_id := auth.uid();
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_claim_id is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid claim review request';
  end if;

  clean_note := left(trim(coalesce(p_review_note, '')), 500);

  select c.*
    into claim_row
    from public.customer_link_claims c
    join public.shops s on s.id = c.shop_id
   where c.id = p_claim_id
     and s.owner_id = actor_id
   for update of c;

  if not found then
    raise exception 'Claim not found';
  end if;

  if claim_row.status <> 'pending' then
    raise exception 'Claim is no longer pending';
  end if;

  reviewed_time := clock_timestamp();

  update public.customer_link_claims
     set status = p_decision,
         reviewed_at = reviewed_time,
         reviewed_by = actor_id,
         review_note = clean_note
   where id = p_claim_id;

  return jsonb_build_object(
    'id', p_claim_id,
    'status', p_decision,
    'reviewed_at', reviewed_time,
    'review_note', clean_note,
    'customer_confirmation_required', (p_decision = 'approved'),
    'ledger_access_granted', false
  );
end;
$$;

revoke all on function private.review_customer_link_claim(uuid, text, text) from public, anon;
grant execute on function private.review_customer_link_claim(uuid, text, text) to authenticated;

create or replace function public.review_customer_link_claim(
  p_claim_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.review_customer_link_claim(p_claim_id, p_decision, p_review_note);
$$;

revoke all on function public.review_customer_link_claim(uuid, text, text) from public, anon;
grant execute on function public.review_customer_link_claim(uuid, text, text) to authenticated;

comment on function public.review_customer_link_claim(uuid, text, text) is
  'Allows only the owning shop account to approve/reject a pending customer claim. Approval does not grant ledger access or substitute for customer consent.';
