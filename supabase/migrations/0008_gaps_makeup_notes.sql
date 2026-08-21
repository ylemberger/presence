-- Gap handling on occurrences + makeup exams + session notes

alter table lesson_occurrences
  add column if not exists gap_handling text;

alter table lesson_occurrences
  drop constraint if exists lesson_occurrences_gap_handling_check;

alter table lesson_occurrences
  add constraint lesson_occurrences_gap_handling_check
  check (
    gap_handling is null
    or gap_handling in ('in_treatment', 'continued')
  );

comment on column lesson_occurrences.gap_handling is
  'When past occurrence has no attendance: in_treatment/continued allow proceeding with reminder; null means unresolved.';

create table if not exists makeup_exams (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  required_exams smallint not null default 1 check (required_exams between 1 and 4),
  completed_exams smallint not null default 0 check (completed_exams >= 0),
  status text not null default 'open'
    check (status in ('open', 'done', 'blocked')),
  notes text,
  created_at timestamptz default now(),
  unique (student_id, lesson_id)
);

alter table makeup_exams enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'makeup_exams' and policyname = 'authenticated_select_makeup_exams'
  ) then
    create policy "authenticated_select_makeup_exams" on makeup_exams for select to authenticated using (true);
    create policy "authenticated_insert_makeup_exams" on makeup_exams for insert to authenticated with check (true);
    create policy "authenticated_update_makeup_exams" on makeup_exams for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_makeup_exams" on makeup_exams for delete to authenticated using (true);
  end if;
end $$;

-- General notes (not tied to a single date) for student or lesson scope
create table if not exists attendance_notes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  body text not null,
  updated_at timestamptz default now(),
  check (
    (student_id is not null and lesson_id is null)
    or (student_id is null and lesson_id is not null)
  )
);

create unique index if not exists idx_attendance_notes_student
  on attendance_notes (academic_year_id, student_id)
  where student_id is not null;

create unique index if not exists idx_attendance_notes_lesson
  on attendance_notes (academic_year_id, lesson_id)
  where lesson_id is not null;

alter table attendance_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_notes' and policyname = 'authenticated_select_attendance_notes'
  ) then
    create policy "authenticated_select_attendance_notes" on attendance_notes for select to authenticated using (true);
    create policy "authenticated_insert_attendance_notes" on attendance_notes for insert to authenticated with check (true);
    create policy "authenticated_update_attendance_notes" on attendance_notes for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_attendance_notes" on attendance_notes for delete to authenticated using (true);
  end if;
end $$;

create index if not exists idx_makeup_exams_year on makeup_exams (academic_year_id);
create index if not exists idx_makeup_exams_student on makeup_exams (student_id);
create index if not exists idx_lo_gap_handling on lesson_occurrences (gap_handling);
