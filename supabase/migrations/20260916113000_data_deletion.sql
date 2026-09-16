-- P3-1: GDPR/CCPA data-deletion verification.
--
-- Two SECURITY DEFINER RPCs so the client can (a) show the user what the
-- server holds, and (b) erase it with server-side verification:
--
--   my_data_summary() -> { analytics_events, quota_rows } for auth.uid()
--   delete_my_data()   -> deletes the caller's rows from analytics_events
--                        and ai_quota_usage, re-counts what is left, and
--                        only then deletes the auth account. The returned
--                        residual counts MUST be zero; the client treats
--                        anything else as a failed deletion.
--
-- Both functions are granted to `authenticated` ONLY. No select/update/
-- delete policies are added to the underlying tables, so the erasure path
-- cannot be abused to read anyone else's rows.
--
-- Apply with: supabase db push
-- (from a machine with the Supabase CLI linked to the project), or
-- POST /v1/projects/{ref}/database/migrations on the Management API.

create or replace function public.my_data_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  return jsonb_build_object(
    'analytics_events', (select count(*) from public.analytics_events where user_id = uid),
    'quota_rows',       (select count(*) from public.ai_quota_usage where user_id = uid)
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
  deleted_events bigint;
  deleted_quota bigint;
  residual_events bigint;
  residual_quota bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1. Erase server-side data belonging to the caller.
  delete from public.analytics_events where user_id = uid;
  get diagnostics deleted_events = row_count;

  delete from public.ai_quota_usage where user_id = uid;
  get diagnostics deleted_quota = row_count;

  -- 2. Verify: re-count. The client must see zeros.
  select count(*) into residual_events from public.analytics_events where user_id = uid;
  select count(*) into residual_quota  from public.ai_quota_usage where user_id = uid;

  if residual_events <> 0 or residual_quota <> 0 then
    raise exception 'deletion verification failed: % analytics rows and % quota rows remain',
      residual_events, residual_quota;
  end if;

  -- 3. Only now delete the auth account (cascades to sessions/tokens).
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
