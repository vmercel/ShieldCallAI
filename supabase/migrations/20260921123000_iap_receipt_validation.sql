-- P1-2: server-side receipt validation storage.
--
-- The validate-receipt edge function writes to these tables with the service
-- role key after a receipt has been verified against the Apple App Store
-- Server API or the Google Play Developer API. Users may read their own rows;
-- there are deliberately NO authenticated INSERT/UPDATE/DELETE policies, so
-- a client can never grant itself a plan — all writes go through the server.

create table if not exists public.iap_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple', 'google')),
  plan_id text not null check (plan_id in ('pro_monthly', 'family_monthly')),
  sku text not null,
  transaction_id text,
  original_transaction_id text,
  purchase_token text,
  status text not null default 'valid'
    check (status in ('valid', 'expired', 'refunded', 'revoked')),
  validated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, transaction_id)
);

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('free', 'pro_monthly', 'family_monthly')),
  source text not null default 'store_receipt',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.iap_purchases enable row level security;
alter table public.user_plans enable row level security;

create policy "users read own iap purchases"
  on public.iap_purchases for select to authenticated
  using (auth.uid() = user_id);

create policy "users read own plan"
  on public.user_plans for select to authenticated
  using (auth.uid() = user_id);

-- Server plan lookup for the signed-in user. Expired plans read back as
-- 'free' so clients never have to do expiry math.
create or replace function public.my_current_plan()
returns table (plan_id text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when up.expires_at is null or up.expires_at > now() then up.plan_id
      else 'free'
    end,
    up.expires_at
  from public.user_plans up
  where up.user_id = auth.uid()
$$;

revoke all on function public.my_current_plan() from public, anon;
grant execute on function public.my_current_plan() to authenticated;

create index if not exists iap_purchases_user_idx on public.iap_purchases(user_id);
