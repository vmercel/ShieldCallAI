-- 2026-10-06: harden the P3-1 erasure RPCs against schema drift.
--
-- delete_my_data() / my_data_summary() assumed public.analytics_events
-- exists. Its creating migration (20260913170000) was never applied to the
-- live project, so on that database the explicit DELETE/COUNT raised
-- "relation public.analytics_events does not exist" and signed-in users
-- could not complete the Delete My Data flow at all (the GDPR/CCPA right
-- to erasure was broken server-side). Erasure must never fail because an
-- optional table is absent: both functions now check to_regclass() first
-- and treat a missing table as zero rows. If the table is absent, no rows
-- could ever have been written to it, so zero is the honest count.
--
-- Applying this migration is enough: it replaces both functions in place.
-- When 20260913170000 is eventually applied, these functions behave
-- exactly as before (guards pass through).

create or replace function public.my_data_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  events_count bigint := 0;
  quota_count bigint := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if to_regclass('public.analytics_events') is not null then
    select count(*) into events_count from public.analytics_events where user_id = uid;
  end if;
  if to_regclass('public.ai_quota_usage') is not null then
    select count(*) into quota_count from public.ai_quota_usage where user_id = uid;
  end if;
  return jsonb_build_object(
    'analytics_events', events_count,
    'quota_rows', quota_count
  );
end;
$$;

revoke all on function public.my_data_summary() from public, anon;
grant execute on function public.my_data_summary() to authenticated;

create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  deleted_events bigint := 0;
  deleted_quota bigint := 0;
  residual_events bigint := 0;
  residual_quota bigint := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1. Erase server-side data belonging to the caller. A table that does
  -- not exist (optional migration not yet applied) counts as zero rows
  -- rather than aborting the whole erasure.
  if to_regclass('public.analytics_events') is not null then
    delete from public.analytics_events where user_id = uid;
    get diagnostics deleted_events = row_count;
    select count(*) into residual_events from public.analytics_events where user_id = uid;
  end if;

  if to_regclass('public.ai_quota_usage') is not null then
    delete from public.ai_quota_usage where user_id = uid;
    get diagnostics deleted_quota = row_count;
    select count(*) into residual_quota from public.ai_quota_usage where user_id = uid;
  end if;

  -- 2. Verify: residuals must be zero, or the client treats this as failed.
  if residual_events <> 0 or residual_quota <> 0 then
    raise exception 'deletion verification failed: % analytics rows and % quota rows remain',
      residual_events, residual_quota;
  end if;

  -- 3. Only now delete the auth account. iap_purchases, user_plans and
  -- voip_tokens all reference auth.users(id) on delete cascade, so they
  -- are erased with the account; nothing else user-owned remains.
  delete from auth.users where id = uid;

  return jsonb_build_object(
    'deleted', jsonb_build_object(
      'analytics_events', deleted_events,
      'quota_rows', deleted_quota
    ),
    'residual', jsonb_build_object(
      'analytics_events', residual_events,
      'quota_rows', residual_quota
    ),
    'account_deleted', true
  );
end;
$$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
