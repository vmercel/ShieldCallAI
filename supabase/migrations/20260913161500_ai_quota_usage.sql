-- P0-3: per-user quotas for AI edge functions.
--
-- Table + atomic consume-and-check RPC used by
-- supabase/functions/_shared/rateLimit.ts.
--
-- Apply with:  supabase db push
-- (from a machine with the Supabase CLI linked to the project).
--
-- The RPC is SECURITY DEFINER and the table has RLS with no policies, so
-- only this function can read/write quota rows; edge functions call it with
-- the anon key. Until this migration is applied, the edge functions fail
-- OPEN (requests allowed, errors loud in the function logs).

create table if not exists public.ai_quota_usage (
  user_id uuid not null,
  function_name text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (user_id, function_name, window_start)
);

alter table public.ai_quota_usage enable row level security;

-- Atomic: insert-or-increment and report whether the new count is within
-- the limit, in a single statement. Concurrent requests serialize on the
-- row lock, so the limit cannot be overshot.
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_function_name text,
  p_window_start timestamptz,
  p_limit integer
)
returns table(request_count integer, allowed boolean)
language sql
security definer
set search_path = public
as $$
  with upsert as (
    insert into public.ai_quota_usage as q (user_id, function_name, window_start, count)
    values (p_user_id, p_function_name, p_window_start, 1)
    on conflict (user_id, function_name, window_start)
    do update set count = q.count + 1
    returning q.count
  )
  select count, count <= p_limit from upsert;
$$;

grant execute on function public.consume_ai_quota(uuid, text, timestamptz, integer)
  to anon, authenticated;

-- Optional hygiene: drop windows older than 7 days. Run on a schedule
-- (pg_cron) or leave to the application; rows are tiny.
-- delete from public.ai_quota_usage where window_start < now() - interval '7 days';
