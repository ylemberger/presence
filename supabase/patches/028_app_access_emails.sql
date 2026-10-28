-- Source of truth for who may use the attendance app.
-- Run on the ATTENDANCE database (not salary). Safe to run again.
-- JWT email only (not user_metadata).
--
-- After this runs, a Google user who is not in app_access_emails cannot
-- read or write any table. Add editors from Vercel ALLOWED_LOGIN_EMAILS:
--   insert into public.app_access_emails (email, role)
--   values ('name@bybs.org.il', 'editor')
--   on conflict (email) do update set role = excluded.role;

create table if not exists public.app_access_emails (
  email text primary key,
  role text not null check (role in ('editor', 'viewer', 'read_all')),
  created_at timestamptz not null default now()
);

alter table public.app_access_emails enable row level security;

insert into public.app_access_emails (email, role) values
  ('sara.m@bybs.org.il', 'viewer'),
  ('shaindi.s@bybs.org.il', 'viewer'),
  ('h.babad@bybs.org.il', 'viewer'),
  ('machshev@bybs.org.il', 'viewer'),
  ('zipora.e@bybs.org.il', 'read_all'),
  ('sby7935@gmail.com', 'read_all'),
  ('t025959714@gmail.com', 'editor'),
  ('yehudit.b@bybs.org.il', 'editor'),
  ('y.lemberger@bybs.org.il', 'editor')
on conflict (email) do nothing;

create or replace function public.access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_access_emails
  where email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  limit 1;
$$;

revoke all on function public.access_role() from public;
revoke all on function public.access_role() from anon;
grant execute on function public.access_role() to authenticated;

create or replace function public.has_app_access()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.access_role() is not null;
$$;

revoke all on function public.has_app_access() from public;
revoke all on function public.has_app_access() from anon;
grant execute on function public.has_app_access() to authenticated;

create or replace function public.is_attendance_viewer()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.access_role() is not distinct from 'viewer';
$$;

revoke all on function public.is_attendance_viewer() from public;
revoke all on function public.is_attendance_viewer() from anon;
grant execute on function public.is_attendance_viewer() to authenticated;

create or replace function public.is_attendance_read_only()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.access_role() is not distinct from 'read_all';
$$;

revoke all on function public.is_attendance_read_only() from public;
revoke all on function public.is_attendance_read_only() from anon;
grant execute on function public.is_attendance_read_only() to authenticated;

create or replace function public.cannot_write_attendance()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.access_role() is distinct from 'editor';
$$;

revoke all on function public.cannot_write_attendance() from public;
revoke all on function public.cannot_write_attendance() from anon;
grant execute on function public.cannot_write_attendance() to authenticated;

drop policy if exists "authenticated_select_app_access_emails" on public.app_access_emails;
drop policy if exists "select_own_app_access_emails" on public.app_access_emails;
drop policy if exists "select_all_app_access_emails_editors" on public.app_access_emails;
drop policy if exists "authenticated_insert_app_access_emails" on public.app_access_emails;
drop policy if exists "authenticated_update_app_access_emails" on public.app_access_emails;
drop policy if exists "authenticated_delete_app_access_emails" on public.app_access_emails;

create policy "select_own_app_access_emails"
  on public.app_access_emails
  for select
  to authenticated
  using (email = lower(trim(coalesce(auth.jwt() ->> 'email', ''))));

create policy "select_all_app_access_emails_editors"
  on public.app_access_emails
  for select
  to authenticated
  using (public.access_role() = 'editor');

create policy "authenticated_insert_app_access_emails"
  on public.app_access_emails
  for insert
  to authenticated
  with check (public.access_role() = 'editor');

create policy "authenticated_update_app_access_emails"
  on public.app_access_emails
  for update
  to authenticated
  using (public.access_role() = 'editor')
  with check (public.access_role() = 'editor');

create policy "authenticated_delete_app_access_emails"
  on public.app_access_emails
  for delete
  to authenticated
  using (public.access_role() = 'editor');

do $$
declare
  pol record;
  viewer_ok text[] := array[
    'academic_years', 'grades', 'classes', 'tracks', 'specializations',
    'students', 'student_assignments',
    'teachers', 'teacher_source_records', 'teacher_teaching_assignments',
    'lessons'
  ];
  select_using text;
begin
  for pol in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'app_access_emails'
      and 'authenticated' = any (roles)
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
    if pol.cmd = 'SELECT' then
      if pol.tablename = any (viewer_ok) then
        select_using := 'public.has_app_access()';
      else
        select_using := 'public.has_app_access() and not public.is_attendance_viewer()';
      end if;
      execute format(
        'create policy %I on public.%I for select to authenticated using (%s)',
        pol.policyname,
        pol.tablename,
        select_using
      );
    elsif pol.cmd = 'INSERT' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (not public.cannot_write_attendance())',
        pol.policyname,
        pol.tablename
      );
    elsif pol.cmd = 'UPDATE' then
      execute format(
        'create policy %I on public.%I for update to authenticated using (not public.cannot_write_attendance()) with check (not public.cannot_write_attendance())',
        pol.policyname,
        pol.tablename
      );
    elsif pol.cmd = 'DELETE' then
      if pol.tablename = 'students' then
        continue;
      end if;
      execute format(
        'create policy %I on public.%I for delete to authenticated using (not public.cannot_write_attendance())',
        pol.policyname,
        pol.tablename
      );
    end if;
  end loop;
end $$;

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all on table public.%I from anon', t.tablename);
    execute format('revoke all on table public.%I from public', t.tablename);
    if t.tablename = 'students' then
      execute format(
        'grant select, insert, update on table public.%I to authenticated',
        t.tablename
      );
    else
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        t.tablename
      );
    end if;
  end loop;
  execute 'revoke all on all sequences in schema public from anon';
  execute 'revoke all on all sequences in schema public from public';
  execute 'grant usage, select on all sequences in schema public to authenticated';
  execute 'alter default privileges in schema public revoke all on tables from anon';
  execute 'alter default privileges in schema public revoke all on tables from public';
  execute 'alter default privileges in schema public grant select, insert, update, delete on tables to authenticated';
end $$;

drop policy if exists "authenticated_delete_students" on public.students;
revoke delete on table public.students from authenticated;
revoke delete on table public.students from anon;
revoke delete on table public.students from public;

notify pgrst, 'reload schema';
select 'app_access_emails is the login and RLS source of truth' as status;
