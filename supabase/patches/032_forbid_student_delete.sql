-- Students are permanent. The app (authenticated/anon) cannot DELETE a students row.
-- Safe to re-run. Table owner in SQL Editor can still delete in a true emergency.

drop policy if exists "authenticated_delete_students" on public.students;

revoke delete on table public.students from authenticated;
revoke delete on table public.students from anon;
revoke delete on table public.students from public;

create or replace function public.forbid_app_student_delete()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon', 'authenticator') then
    raise exception 'אין מחיקה פיזית של תלמידות מהאפליקציה';
  end if;
  return old;
end;
$$;יך

drop trigger if exists trg_forbid_app_student_delete on public.students;
create trigger trg_forbid_app_student_delete
  before delete on public.students
  for each row
  execute function public.forbid_app_student_delete();
