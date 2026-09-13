-- P1-7: privacy-safe analytics events (feature usage only, no audio).
--
-- The client (services/analytics.ts) only ever sends allowlisted event names
-- with scrubbed primitive props. This table is INSERT-only: authenticated
-- users can write their own events and can never read them back.
--
-- Apply with: supabase db push   (from a linked Supabase CLI environment)

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

-- Insert-only: a user can insert rows tagged with their own auth.uid(),
-- and nothing else. No select/update/delete policies exist, so RLS
-- denies reads by design.
drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own
  on public.analytics_events
  for insert
  to authenticated
  with check (user_id = auth.uid());
