-- Read-all (no writes): zipora.e@bybs.org.il, sby7935@gmail.com
-- Does not delete rows. Does not change list-only viewers.
-- Run on the ATTENDANCE database (the one with public.lessons), never salary.
-- Safe to run again.

create or replace function public.is_attendance_read_only()
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
    'zipora.e@bybs.org.il',
    'sby7935@gmail.com'
  );
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
  select public.is_attendance_viewer() or public.is_attendance_read_only();
$$;

revoke all on function public.cannot_write_attendance() from public;
revoke all on function public.cannot_write_attendance() from anon;
grant execute on function public.cannot_write_attendance() to authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any (roles)
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
    if pol.cmd = 'INSERT' then
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
      execute format(
        'create policy %I on public.%I for delete to authenticated using (not public.cannot_write_attendance())',
        pol.policyname,
        pol.tablename
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
