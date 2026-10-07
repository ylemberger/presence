-- View-only accounts may read lesson rows (teacher card). No row changes.
-- Replaces only the lessons SELECT rule. Safe to run again.
-- Run on the attendance database, never the salary database.

drop policy if exists "authenticated_select_lessons" on public.lessons;

create policy "authenticated_select_lessons"
  on public.lessons
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
