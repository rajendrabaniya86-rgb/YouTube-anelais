-- 010: tighten exposed table privileges and event-trigger function execution.
-- RLS remains the row-level boundary; SQL grants provide an additional table-level boundary.
revoke all privileges on all tables in schema public from anon;

-- Financial ledger and audit history are append-only at both policy and privilege layers.
revoke update, delete, truncate on table public.ledger_entries from authenticated;
revoke update, delete, truncate on table public.audit_events from authenticated;

-- This is a database event-trigger helper, not an API function.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Keep default privileges for future public tables conservative for anon.
alter default privileges in schema public revoke all on tables from anon;
