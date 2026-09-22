-- P1-4: VoIP push token registry.
--
-- The client registers its PushKit (iOS) / high-priority FCM (Android) device
-- token here after sign-in. The voip-push edge function (service role) reads
-- this table to deliver incoming-call pushes that wake the app in the
-- background. Tokens are user-owned; cleanup of stale tokens is owned by the
-- edge function (service role), never by the client.

create table if not exists public.voip_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  app_id text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.voip_tokens enable row level security;

-- A client manages only its own tokens (register / refresh / unregister).
create policy voip_tokens_select_own
  on public.voip_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy voip_tokens_insert_own
  on public.voip_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy voip_tokens_update_own
  on public.voip_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy voip_tokens_delete_own
  on public.voip_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- No policies for anon: unauthenticated clients see and touch nothing.
