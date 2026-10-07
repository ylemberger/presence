-- View-only logins: sara.m@bybs.org.il, shaindi.s@bybs.org.il, h.babad@bybs.org.il, machshev@bybs.org.il
-- Run on the ATTENDANCE Supabase project (the one with public.lessons), never the salary database.
-- Does not delete or rewrite rows. Safe to run again.
-- Editors keep full access. Viewers may read only the student and teacher lists.

create or replace function public.is_attendance_viewer()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select lower(coalesce(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    ''
  )) in (
    'sara.m@bybs.org.il',
    'shaindi.s@bybs.org.il',
    'h.babad@bybs.org.il',
    'machshev@bybs.org.il'
  );
$$;

revoke all on function public.is_attendance_viewer() from public;
revoke all on function public.is_attendance_viewer() from anon;
grant execute on function public.is_attendance_viewer() to authenticated;

do $$
declare
  pol record;
  readable boolean;
begin
  for pol in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any (roles)
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  loop
    readable := pol.tablename in (
      'academic_years', 'grades', 'classes', 'tracks', 'specializations',
      'students', 'student_assignments',
      'teachers', 'teacher_source_records', 'teacher_teaching_assignments'
    );
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
    if pol.cmd = 'SELECT' then
      execute format(
        'create policy %I on public.%I for select to authenticated using (%s)',
        pol.policyname,
        pol.tablename,
        case when readable then 'true' else 'not public.is_attendance_viewer()' end
      );
    elsif pol.cmd = 'INSERT' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (not public.is_attendance_viewer())',
        pol.policyname,
        pol.tablename
      );
    elsif pol.cmd = 'UPDATE' then
      execute format(
        'create policy %I on public.%I for update to authenticated using (not public.is_attendance_viewer()) with check (not public.is_attendance_viewer())',
        pol.policyname,
        pol.tablename
      );
    elsif pol.cmd = 'DELETE' then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (not public.is_attendance_viewer())',
        pol.policyname,
        pol.tablename
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
