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
  job_type text not null default 'Heavy',
  title text not null,
  status text not null default 'Open',
  work_order text,
  job_date date,
  customer_name text,
  customer_phone text,
  customer_email text,
  machine text,
  serial text,
  customer text,
  meter text,
  year text,
  make text,
  model text,
  vin text,
  mileage text,
  summary text not null,
  complaint text,
  cause text,
  correction text,
  customer_concern text,
  diagnosis text,
  repair_performed text,
  parts text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.jobs add column if not exists id uuid default gen_random_uuid();
alter table public.jobs add column if not exists job_type text default 'Heavy';
alter table public.jobs add column if not exists title text;
alter table public.jobs add column if not exists status text default 'Open';
alter table public.jobs add column if not exists work_order text;
alter table public.jobs add column if not exists job_date date;
alter table public.jobs add column if not exists customer_name text;
alter table public.jobs add column if not exists customer_phone text;
alter table public.jobs add column if not exists customer_email text;
alter table public.jobs add column if not exists machine text;
alter table public.jobs add column if not exists serial text;
alter table public.jobs add column if not exists customer text;
alter table public.jobs add column if not exists meter text;
alter table public.jobs add column if not exists year text;
alter table public.jobs add column if not exists make text;
alter table public.jobs add column if not exists model text;
alter table public.jobs add column if not exists vin text;
alter table public.jobs add column if not exists mileage text;
alter table public.jobs add column if not exists summary text;
alter table public.jobs add column if not exists complaint text;
alter table public.jobs add column if not exists cause text;
alter table public.jobs add column if not exists correction text;
alter table public.jobs add column if not exists customer_concern text;
alter table public.jobs add column if not exists diagnosis text;
alter table public.jobs add column if not exists repair_performed text;
alter table public.jobs add column if not exists parts text;
alter table public.jobs add column if not exists created_at timestamptz default now();
alter table public.jobs add column if not exists created_by uuid references public.profiles(id) on delete cascade;
alter table public.jobs add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.jobs alter column job_type set default 'Heavy';
alter table public.jobs alter column status set default 'Open';
alter table public.jobs alter column created_at set default now();

update public.jobs
set job_type = 'Heavy'
where job_type is null;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  created_at timestamptz not null default now()
);

alter table public.job_photos add column if not exists id uuid default gen_random_uuid();
alter table public.job_photos add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.job_photos add column if not exists uploaded_by uuid references public.profiles(id) on delete cascade;
alter table public.job_photos add column if not exists file_path text;
alter table public.job_photos add column if not exists file_name text;
alter table public.job_photos add column if not exists created_at timestamptz default now();

alter table public.job_photos alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_photos'::regclass
      and contype = 'p'
  ) then
    alter table public.job_photos add primary key (id);
  end if;
end;
$$;

create unique index if not exists job_photos_file_path_key
on public.job_photos (file_path);

create index if not exists job_photos_job_id_created_at_idx
on public.job_photos (job_id, created_at);

create or replace function public.set_job_photo_uploaded_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.uploaded_by := coalesce(new.uploaded_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists set_job_photo_uploaded_by_before_insert on public.job_photos;
create trigger set_job_photo_uploaded_by_before_insert
before insert on public.job_photos
for each row execute function public.set_job_photo_uploaded_by();

alter table public.job_photos enable row level security;

drop policy if exists "job_photos_select_own_jobs" on public.job_photos;
create policy "job_photos_select_own_jobs"
on public.job_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = job_photos.job_id
      and jobs.created_by = auth.uid()
  )
);

drop policy if exists "job_photos_insert_own_jobs" on public.job_photos;
create policy "job_photos_insert_own_jobs"
on public.job_photos
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.jobs
    where jobs.id = job_photos.job_id
      and jobs.created_by = auth.uid()
  )
);

drop policy if exists "job_photos_delete_own_jobs" on public.job_photos;
create policy "job_photos_delete_own_jobs"
on public.job_photos
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.jobs
    where jobs.id = job_photos.job_id
      and jobs.created_by = auth.uid()
  )
);

drop policy if exists "storage_job_photos_select_own_folder" on storage.objects;
create policy "storage_job_photos_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_job_photos_insert_own_folder" on storage.objects;
create policy "storage_job_photos_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_job_photos_delete_own_folder" on storage.objects;
create policy "storage_job_photos_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'diagnostic-files',
  'diagnostic-files',
  false,
  52428800
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

create table if not exists public.diagnostic_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_type text not null default 'Other',
  created_at timestamptz not null default now()
);

alter table public.diagnostic_files add column if not exists id uuid default gen_random_uuid();
alter table public.diagnostic_files add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.diagnostic_files add column if not exists uploaded_by uuid references public.profiles(id) on delete cascade;
alter table public.diagnostic_files add column if not exists file_name text;
alter table public.diagnostic_files add column if not exists file_path text;
alter table public.diagnostic_files add column if not exists file_type text default 'Other';
alter table public.diagnostic_files add column if not exists created_at timestamptz default now();

alter table public.diagnostic_files alter column file_type set default 'Other';
alter table public.diagnostic_files alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.diagnostic_files'::regclass
      and contype = 'p'
  ) then
    alter table public.diagnostic_files add primary key (id);
  end if;
end;
$$;

create unique index if not exists diagnostic_files_file_path_key
on public.diagnostic_files (file_path);

create index if not exists diagnostic_files_job_id_created_at_idx
on public.diagnostic_files (job_id, created_at);

create or replace function public.set_diagnostic_file_uploaded_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.uploaded_by := coalesce(new.uploaded_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists set_diagnostic_file_uploaded_by_before_insert on public.diagnostic_files;
create trigger set_diagnostic_file_uploaded_by_before_insert
before insert on public.diagnostic_files
for each row execute function public.set_diagnostic_file_uploaded_by();

alter table public.diagnostic_files enable row level security;

drop policy if exists "diagnostic_files_select_own_jobs" on public.diagnostic_files;
create policy "diagnostic_files_select_own_jobs"
on public.diagnostic_files
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = diagnostic_files.job_id
      and jobs.created_by = auth.uid()
  )
);

drop policy if exists "diagnostic_files_insert_own_heavy_jobs" on public.diagnostic_files;
create policy "diagnostic_files_insert_own_heavy_jobs"
on public.diagnostic_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.jobs
    where jobs.id = diagnostic_files.job_id
      and jobs.created_by = auth.uid()
      and jobs.job_type = 'Heavy'
  )
);

drop policy if exists "diagnostic_files_delete_own_jobs" on public.diagnostic_files;
create policy "diagnostic_files_delete_own_jobs"
on public.diagnostic_files
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.jobs
    where jobs.id = diagnostic_files.job_id
      and jobs.created_by = auth.uid()
  )
);

drop policy if exists "storage_diagnostic_files_select_own_folder" on storage.objects;
create policy "storage_diagnostic_files_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'diagnostic-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_diagnostic_files_insert_own_folder" on storage.objects;
create policy "storage_diagnostic_files_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'diagnostic-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_diagnostic_files_delete_own_folder" on storage.objects;
create policy "storage_diagnostic_files_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'diagnostic-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
