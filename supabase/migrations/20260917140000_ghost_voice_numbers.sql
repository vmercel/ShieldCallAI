-- Ghost Voice: map dialed Twilio numbers to ShieldCall users.
-- The voice agent looks up the called number here to find whose persona
-- should answer and which call_records rows belong to which user.

create table if not exists public.ghost_voice_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  twilio_number text not null unique,
  persona_name text not null default 'Alex',
  owner_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ghost_voice_numbers_user_id_idx
  on public.ghost_voice_numbers (user_id);

-- Service-role only: the agent uses the service role key (bypasses RLS).
-- App clients read their own call_records through the existing policies.
alter table public.ghost_voice_numbers enable row level security;

drop policy if exists "service role full access" on public.ghost_voice_numbers;
create policy "service role full access" on public.ghost_voice_numbers
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
