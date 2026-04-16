-- IronProof Supabase setup
-- Run this in the Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'Open',
  work_order text,
  job_date date,
  machine text,
  serial text,
  customer text,
  meter text,
  summary text not null,
  complaint text,
  cause text,
  correction text,
  parts text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.jobs add column if not exists id uuid default gen_random_uuid();
alter table public.jobs add column if not exists title text;
alter table public.jobs add column if not exists status text default 'Open';
alter table public.jobs add column if not exists work_order text;
alter table public.jobs add column if not exists job_date date;
alter table public.jobs add column if not exists machine text;
alter table public.jobs add column if not exists serial text;
alter table public.jobs add column if not exists customer text;
alter table public.jobs add column if not exists meter text;
alter table public.jobs add column if not exists summary text;
alter table public.jobs add column if not exists complaint text;
alter table public.jobs add column if not exists cause text;
alter table public.jobs add column if not exists correction text;
alter table public.jobs add column if not exists parts text;
alter table public.jobs add column if not exists created_at timestamptz default now();
alter table public.jobs add column if not exists created_by uuid references public.profiles(id) on delete cascade;
alter table public.jobs add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.jobs alter column status set default 'Open';
alter table public.jobs alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and contype = 'p'
  ) then
    alter table public.jobs add primary key (id);
  end if;
end;
$$;

create index if not exists jobs_created_by_created_at_idx
on public.jobs (created_by, created_at desc);

create or replace function public.set_job_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_job_user_fields_before_write on public.jobs;
create trigger set_job_user_fields_before_write
before insert or update on public.jobs
for each row execute function public.set_job_user_fields();

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own"
on public.jobs
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own"
on public.jobs
for insert
to authenticated
with check (created_by = auth.uid() and updated_by = auth.uid());

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
on public.jobs
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid() and updated_by = auth.uid());

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own"
on public.jobs
for delete
to authenticated
using (created_by = auth.uid());
