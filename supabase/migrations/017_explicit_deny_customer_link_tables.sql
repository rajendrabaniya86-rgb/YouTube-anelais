-- Keep customer-link invite and claim tables inaccessible through direct client Data API calls.
-- Trusted Edge Functions use the service role after validating the caller and shop ownership.
create policy "deny_direct_api_access"
on public.customer_link_invites
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_direct_api_access"
on public.customer_link_claims
for all
to anon, authenticated
using (false)
with check (false);
