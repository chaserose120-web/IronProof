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

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.crews add column if not exists id uuid default gen_random_uuid();
alter table public.crews add column if not exists name text;
alter table public.crews add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.crews add column if not exists created_at timestamptz default now();
alter table public.crews alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.crews'::regclass
      and contype = 'p'
  ) then
    alter table public.crews add primary key (id);
  end if;
end;
$$;

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

alter table public.crew_members add column if not exists id uuid default gen_random_uuid();
alter table public.crew_members add column if not exists crew_id uuid references public.crews(id) on delete cascade;
alter table public.crew_members add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.crew_members add column if not exists role text default 'member';
alter table public.crew_members add column if not exists created_at timestamptz default now();
alter table public.crew_members alter column role set default 'member';
alter table public.crew_members alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.crew_members'::regclass
      and contype = 'p'
  ) then
    alter table public.crew_members add primary key (id);
  end if;
end;
$$;

create unique index if not exists crew_members_crew_id_user_id_key
on public.crew_members (crew_id, user_id);

create index if not exists crew_members_user_id_idx
on public.crew_members (user_id);

create or replace function public.add_crew_creator_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.crew_members (crew_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (crew_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists add_crew_creator_member_after_insert on public.crews;
create trigger add_crew_creator_member_after_insert
after insert on public.crews
for each row execute function public.add_crew_creator_member();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'Heavy',
  visibility_type text not null default 'solo',
  crew_id uuid,
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
alter table public.jobs add column if not exists visibility_type text default 'solo';
alter table public.jobs add column if not exists crew_id uuid;
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
alter table public.jobs alter column visibility_type set default 'solo';
alter table public.jobs alter column status set default 'Open';
alter table public.jobs alter column created_at set default now();

update public.jobs
set job_type = 'Heavy'
where job_type is null;

update public.jobs
set visibility_type = 'solo',
    crew_id = null
where visibility_type is null;

update public.jobs
set crew_id = null
where visibility_type = 'solo';

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

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.jobs'::regclass
    and contype = 'f'
    and conkey = array[
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.jobs'::regclass
          and attname = 'crew_id'
      )
    ]::smallint[]
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.jobs drop constraint %I', constraint_name);
  end if;
end;
$$;

create or replace function public.generate_job_crew_join_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'JOB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.job_crews
      where join_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create table if not exists public.job_crews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  join_code text not null default public.generate_job_crew_join_code(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.job_crews add column if not exists id uuid default gen_random_uuid();
alter table public.job_crews add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.job_crews add column if not exists name text;
alter table public.job_crews add column if not exists join_code text default public.generate_job_crew_join_code();
alter table public.job_crews add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.job_crews add column if not exists created_at timestamptz default now();
alter table public.job_crews alter column join_code set default public.generate_job_crew_join_code();
alter table public.job_crews alter column created_at set default now();

update public.job_crews
set join_code = public.generate_job_crew_join_code()
where join_code is null;

update public.job_crews
set name = coalesce(nullif(trim(jobs.title), '') || ' Crew', 'Crew for Job ' || job_crews.job_id::text)
from public.jobs
where job_crews.job_id = jobs.id
  and job_crews.name is null;

update public.job_crews
set name = 'Crew for Job ' || job_id::text
where name is null;

alter table public.job_crews alter column name set not null;
alter table public.job_crews alter column join_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_crews'::regclass
      and contype = 'p'
  ) then
    alter table public.job_crews add primary key (id);
  end if;
end;
$$;

create unique index if not exists job_crews_job_id_key
on public.job_crews (job_id);

create unique index if not exists job_crews_join_code_key
on public.job_crews (join_code);

create table if not exists public.job_crew_members (
  id uuid primary key default gen_random_uuid(),
  job_crew_id uuid not null references public.job_crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'crew_worker',
  created_at timestamptz not null default now()
);

alter table public.job_crew_members add column if not exists id uuid default gen_random_uuid();
alter table public.job_crew_members add column if not exists job_crew_id uuid references public.job_crews(id) on delete cascade;
alter table public.job_crew_members add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.job_crew_members add column if not exists role text default 'crew_worker';
alter table public.job_crew_members add column if not exists created_at timestamptz default now();
alter table public.job_crew_members alter column role set default 'crew_worker';
alter table public.job_crew_members alter column created_at set default now();

update public.job_crew_members
set role = 'crew_worker'
where role is null
  or role not in ('crew_lead', 'crew_worker', 'supervisor');

alter table public.job_crew_members alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_crew_members'::regclass
      and contype = 'p'
  ) then
    alter table public.job_crew_members add primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_crew_members'::regclass
      and conname = 'job_crew_members_role_check'
  ) then
    alter table public.job_crew_members
    add constraint job_crew_members_role_check
    check (role in ('crew_lead', 'crew_worker', 'supervisor'));
  end if;
end;
$$;

create unique index if not exists job_crew_members_job_crew_id_user_id_key
on public.job_crew_members (job_crew_id, user_id);

insert into public.job_crews (job_id, name, created_by)
select jobs.id,
       coalesce(nullif(trim(jobs.title), '') || ' Crew', 'Crew for Job ' || jobs.id::text),
       jobs.created_by
from public.jobs
where jobs.visibility_type = 'crew'
  and not exists (
    select 1
    from public.job_crews
    where job_crews.job_id = jobs.id
  );

insert into public.job_crew_members (job_crew_id, user_id, role)
select job_crews.id, jobs.created_by, 'crew_lead'
from public.jobs
join public.job_crews on job_crews.job_id = jobs.id
where jobs.visibility_type = 'crew'
  and jobs.created_by is not null
on conflict (job_crew_id, user_id) do nothing;

insert into public.job_crew_members (job_crew_id, user_id, role)
select job_crews.id,
       crew_members.user_id,
       case
         when crew_members.role = 'owner' then 'crew_lead'
         else 'crew_worker'
       end
from public.jobs
join public.job_crews on job_crews.job_id = jobs.id
join public.crew_members on crew_members.crew_id = jobs.crew_id
where jobs.visibility_type = 'crew'
on conflict (job_crew_id, user_id) do nothing;

update public.jobs
set crew_id = job_crews.id
from public.job_crews
where jobs.id = job_crews.job_id
  and jobs.visibility_type = 'crew';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_crew_id_fkey'
  ) then
    alter table public.jobs
    add constraint jobs_crew_id_fkey
    foreign key (crew_id) references public.job_crews(id) on delete set null
    not valid;
  end if;
end;
$$;

alter table public.jobs validate constraint jobs_crew_id_fkey;

create index if not exists jobs_created_by_created_at_idx
on public.jobs (created_by, created_at desc);

create index if not exists jobs_crew_id_created_at_idx
on public.jobs (crew_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_visibility_type_check'
  ) then
    alter table public.jobs
    add constraint jobs_visibility_type_check
    check (visibility_type in ('solo', 'crew'));
  end if;
end;
$$;

create or replace function public.set_job_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.visibility_type := coalesce(new.visibility_type, 'solo');

  if new.visibility_type <> 'crew' then
    new.crew_id := null;
  end if;

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

create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members
    where crew_members.crew_id = target_crew_id
      and crew_members.user_id = auth.uid()
  );
$$;

create or replace function public.get_job_crew_role(target_job_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select job_crew_members.role
  from public.job_crew_members
  join public.job_crews on job_crews.id = job_crew_members.job_crew_id
  where job_crews.job_id = target_job_id
    and job_crew_members.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_job_crew_member(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_crew_members
    join public.job_crews on job_crews.id = job_crew_members.job_crew_id
    where job_crews.job_id = target_job_id
      and job_crew_members.user_id = auth.uid()
  );
$$;

create or replace function public.is_job_crew_lead(target_job_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_crew_members
    where job_crew_members.job_crew_id = target_job_crew_id
      and job_crew_members.user_id = auth.uid()
      and job_crew_members.role = 'crew_lead'
  );
$$;

create or replace function public.can_access_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where jobs.id = target_job_id
      and (
        (coalesce(jobs.visibility_type, 'solo') = 'solo' and jobs.created_by = auth.uid())
        or (
          jobs.visibility_type = 'crew'
          and (
            jobs.created_by = auth.uid()
            or exists (
              select 1
              from public.job_crew_members
              join public.job_crews on job_crews.id = job_crew_members.job_crew_id
              where job_crews.job_id = jobs.id
                and job_crew_members.user_id = auth.uid()
            )
          )
        )
      )
  );
$$;

create or replace function public.can_manage_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where jobs.id = target_job_id
      and (
        jobs.created_by = auth.uid()
        or public.get_job_crew_role(jobs.id) in ('crew_lead', 'crew_worker')
      )
  );
$$;

create or replace function public.add_job_crew_creator_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_crew_members (job_crew_id, user_id, role)
  values (new.id, coalesce(new.created_by, auth.uid()), 'crew_lead')
  on conflict (job_crew_id, user_id) do nothing;

  update public.jobs
  set crew_id = new.id,
      visibility_type = 'crew'
  where id = new.job_id;

  return new;
end;
$$;

drop trigger if exists add_job_crew_creator_member_after_insert on public.job_crews;
create trigger add_job_crew_creator_member_after_insert
after insert on public.job_crews
for each row execute function public.add_job_crew_creator_member();

drop trigger if exists set_job_crew_member_job_id_before_insert on public.job_crew_members;
drop function if exists public.set_job_crew_member_job_id();

create or replace function public.join_job_crew(join_code_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  crew_record public.job_crews%rowtype;
begin
  select *
  into crew_record
  from public.job_crews
  where upper(join_code) = upper(trim(join_code_input));

  if crew_record.id is null then
    raise exception 'No job crew found for that join code.';
  end if;

  insert into public.job_crew_members (job_crew_id, user_id, role)
  values (crew_record.id, auth.uid(), 'crew_worker')
  on conflict (job_crew_id, user_id) do nothing;
end;
$$;

drop policy if exists "profiles_select_job_crew_members" on public.profiles;
create policy "profiles_select_job_crew_members"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.job_crew_members current_member
    join public.job_crew_members visible_member
      on visible_member.job_crew_id = current_member.job_crew_id
    where current_member.user_id = auth.uid()
      and visible_member.user_id = profiles.id
  )
);

alter table public.job_crews enable row level security;
alter table public.job_crew_members enable row level security;

drop policy if exists "job_crews_select_accessible_jobs" on public.job_crews;
create policy "job_crews_select_accessible_jobs"
on public.job_crews
for select
to authenticated
using (public.can_access_job(job_id));

drop policy if exists "job_crews_insert_manageable_jobs" on public.job_crews;
create policy "job_crews_insert_manageable_jobs"
on public.job_crews
for insert
to authenticated
with check (created_by = auth.uid() and public.can_manage_job(job_id));

drop policy if exists "job_crews_delete_manageable_jobs" on public.job_crews;
create policy "job_crews_delete_manageable_jobs"
on public.job_crews
for delete
to authenticated
using (public.can_manage_job(job_id));

drop policy if exists "job_crew_members_select_accessible_jobs" on public.job_crew_members;
create policy "job_crew_members_select_accessible_jobs"
on public.job_crew_members
for select
to authenticated
using (
  exists (
    select 1
    from public.job_crews
    where job_crews.id = job_crew_members.job_crew_id
      and public.can_access_job(job_crews.job_id)
  )
);

drop policy if exists "job_crew_members_insert_manageable_jobs" on public.job_crew_members;
create policy "job_crew_members_insert_manageable_jobs"
on public.job_crew_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.job_crews
    where job_crews.id = job_crew_members.job_crew_id
      and public.can_manage_job(job_crews.job_id)
  )
);

drop policy if exists "job_crew_members_update_manageable_jobs" on public.job_crew_members;
create policy "job_crew_members_update_manageable_jobs"
on public.job_crew_members
for update
to authenticated
using (public.is_job_crew_lead(job_crew_id) and role <> 'crew_lead')
with check (
  public.is_job_crew_lead(job_crew_id)
  and role in ('crew_worker', 'supervisor')
);

drop policy if exists "job_crew_members_delete_manageable_jobs" on public.job_crew_members;
create policy "job_crew_members_delete_manageable_jobs"
on public.job_crew_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.job_crews
    where job_crews.id = job_crew_members.job_crew_id
      and public.can_manage_job(job_crews.job_id)
  )
);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

drop policy if exists "crews_select_member" on public.crews;
create policy "crews_select_member"
on public.crews
for select
to authenticated
using (created_by = auth.uid() or public.is_crew_member(id));

drop policy if exists "crews_insert_creator" on public.crews;
create policy "crews_insert_creator"
on public.crews
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "crews_update_creator" on public.crews;
create policy "crews_update_creator"
on public.crews
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "crew_members_select_member" on public.crew_members;
create policy "crew_members_select_member"
on public.crew_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_crew_member(crew_id)
  or exists (
    select 1
    from public.crews
    where crews.id = crew_members.crew_id
      and crews.created_by = auth.uid()
  )
);

drop policy if exists "crew_members_insert_self_or_creator" on public.crew_members;
drop policy if exists "crew_members_insert_creator" on public.crew_members;
create policy "crew_members_insert_creator"
on public.crew_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.crews
    where crews.id = crew_members.crew_id
      and crews.created_by = auth.uid()
  )
);

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_own" on public.jobs;
drop policy if exists "jobs_select_visible" on public.jobs;
create policy "jobs_select_visible"
on public.jobs
for select
to authenticated
using (public.can_access_job(id));

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own"
on public.jobs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and (
    (coalesce(visibility_type, 'solo') = 'solo' and crew_id is null)
    or visibility_type = 'crew'
  )
);

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
on public.jobs
for update
to authenticated
using (public.can_manage_job(id))
with check (
  updated_by = auth.uid()
  and (
    (coalesce(visibility_type, 'solo') = 'solo' and crew_id is null)
    or visibility_type = 'crew'
  )
);

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own"
on public.jobs
for delete
to authenticated
using (public.can_manage_job(id));

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
drop policy if exists "job_photos_select_visible_jobs" on public.job_photos;
create policy "job_photos_select_own_jobs"
on public.job_photos
for select
to authenticated
using (public.can_access_job(job_id));

drop policy if exists "job_photos_insert_own_jobs" on public.job_photos;
create policy "job_photos_insert_own_jobs"
on public.job_photos
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_manage_job(job_id)
);

drop policy if exists "job_photos_delete_own_jobs" on public.job_photos;
create policy "job_photos_delete_own_jobs"
on public.job_photos
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or public.can_manage_job(job_id)
);

drop policy if exists "storage_job_photos_select_own_folder" on storage.objects;
create policy "storage_job_photos_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.job_photos
      where job_photos.file_path = storage.objects.name
        and public.can_access_job(job_photos.job_id)
    )
  )
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
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.job_photos
      where job_photos.file_path = storage.objects.name
        and (
          job_photos.uploaded_by = auth.uid()
          or public.can_manage_job(job_photos.job_id)
        )
    )
  )
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
using (public.can_access_job(job_id));

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
      and public.can_manage_job(jobs.id)
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
  or public.can_manage_job(job_id)
);

drop policy if exists "storage_diagnostic_files_select_own_folder" on storage.objects;
create policy "storage_diagnostic_files_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'diagnostic-files'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.diagnostic_files
      where diagnostic_files.file_path = storage.objects.name
        and public.can_access_job(diagnostic_files.job_id)
    )
  )
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
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.diagnostic_files
      where diagnostic_files.file_path = storage.objects.name
        and (
          diagnostic_files.uploaded_by = auth.uid()
          or public.can_manage_job(diagnostic_files.job_id)
        )
    )
  )
);
