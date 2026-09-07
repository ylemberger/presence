-- הסרה ידנית של תלמידה משיעור ספציפי, בלי שהשיוך האוטומטי יחזיר אותה.
-- בטוח להרצה חוזרת.

create table if not exists student_lesson_exclusions (
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (student_id, lesson_id)
);

create index if not exists idx_student_lesson_exclusions_lesson
  on student_lesson_exclusions (lesson_id);

alter table student_lesson_exclusions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'student_lesson_exclusions'
      and policyname = 'authenticated_select_student_lesson_exclusions'
  ) then
    create policy "authenticated_select_student_lesson_exclusions"
      on student_lesson_exclusions for select to authenticated using (true);
    create policy "authenticated_insert_student_lesson_exclusions"
      on student_lesson_exclusions for insert to authenticated with check (true);
    create policy "authenticated_update_student_lesson_exclusions"
      on student_lesson_exclusions for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_student_lesson_exclusions"
      on student_lesson_exclusions for delete to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';

select '018 student lesson exclusions ok' as status;
