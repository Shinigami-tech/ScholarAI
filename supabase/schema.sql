create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'FREE' check (plan in ('FREE','PRO','PREMIUM')),
  daily_units integer not null default 0 check (daily_units >= 0),
  daily_units_reset_at timestamptz not null default (date_trunc('day', now() at time zone 'utc') + interval '1 day'),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  points integer not null default 0,
  streak_days integer not null default 0,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text,
  title text,
  analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  units integer not null check (units >= 0),
  model text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for select using (auth.uid() = id);

drop policy if exists "analyses self" on public.analyses;
create policy "analyses self" on public.analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "usage self" on public.usage_events;
create policy "usage self" on public.usage_events for select using (auth.uid() = user_id);

create index if not exists analyses_user_id_created_at_idx on public.analyses(user_id, created_at desc);
create index if not exists usage_events_user_id_created_at_idx on public.usage_events(user_id, created_at desc);
