-- Technician AI first multi-factory pilot schema for Supabase.
-- Auth users live in auth.users. The app stores workspace membership locally
-- in the API database for this PR, but these tables prepare the Supabase
-- project for the same organization/factory model.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.factories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  llm_provider text check (llm_provider in ('deepseek', 'openai', 'google', 'anthropic')),
  llm_model text,
  llm_base_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  factory_id uuid not null references public.factories(id) on delete cascade,
  role text not null check (role in ('org_admin', 'supervisor', 'technician', 'viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, factory_id)
);

alter table public.organizations enable row level security;
alter table public.factories enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy "users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "users can read own memberships"
on public.memberships for select
to authenticated
using (user_id = auth.uid());
