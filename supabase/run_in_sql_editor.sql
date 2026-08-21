alter table students add column if not exists cohort_number integer;
update students set cohort_number = 1 where cohort_number is null;
alter table students alter column cohort_number set not null;
alter table students alter column cohort_number set default 1;
alter table students drop constraint if exists students_cohort_positive;
alter table students add constraint students_cohort_positive check (cohort_number >= 1);

alter table student_assignments add column if not exists secondary_specialization_id uuid references specializations(id);
alter table student_assignments add column if not exists is_psychology boolean;
update student_assignments set is_psychology = false where is_psychology is null;
alter table student_assignments alter column is_psychology set not null;
alter table student_assignments alter column is_psychology set default false;

alter table teacher_teaching_assignments add column if not exists for_psychology boolean;
update teacher_teaching_assignments set for_psychology = false where for_psychology is null;
alter table teacher_teaching_assignments alter column for_psychology set not null;
alter table teacher_teaching_assignments alter column for_psychology set default false;

alter table lessons add column if not exists for_psychology boolean;
update lessons set for_psychology = false where for_psychology is null;
alter table lessons alter column for_psychology set not null;
alter table lessons alter column for_psychology set default false;

alter table lessons drop constraint if exists lessons_billing_scope_check;
alter table lessons add constraint lessons_billing_scope_check check (
  (billing_type = 'specialization' and specialization_id is not null and class_id is null and track_id is null and for_psychology = false)
  or (billing_type = 'mandatory' and specialization_id is null and (for_psychology = true or class_id is not null or track_id is not null))
);

alter table teacher_teaching_assignments drop constraint if exists tta_billing_scope_check;
alter table teacher_teaching_assignments add constraint tta_billing_scope_check check (
  (billing_type = 'specialization' and specialization_id is not null and class_id is null and track_id is null and for_psychology = false)
  or (billing_type = 'mandatory' and specialization_id is null and (for_psychology = true or class_id is not null or track_id is not null))
);

insert into grades (academic_year_id, name)
select y.id, g.name
from academic_years y
cross join (values ('א'), ('ב'), ('ג')) as g(name)
where not exists (select 1 from grades existing where existing.academic_year_id = y.id and existing.name = g.name);

create index if not exists idx_students_cohort on students (cohort_number);
create index if not exists idx_sa_secondary_spec on student_assignments (secondary_specialization_id);
create index if not exists idx_lessons_psychology on lessons (for_psychology);

alter table lesson_occurrences add column if not exists gap_handling text;
alter table lesson_occurrences drop constraint if exists lesson_occurrences_gap_handling_check;
alter table lesson_occurrences add constraint lesson_occurrences_gap_handling_check check (gap_handling is null or gap_handling in ('in_treatment', 'continued'));

create table if not exists makeup_exams (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  required_exams smallint not null default 1 check (required_exams between 1 and 4),
  completed_exams smallint not null default 0 check (completed_exams >= 0),
  status text not null default 'open' check (status in ('open', 'done', 'blocked')),
  notes text,
  created_at timestamptz default now(),
  unique (student_id, lesson_id)
);
alter table makeup_exams enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'makeup_exams' and policyname = 'authenticated_select_makeup_exams') then
    create policy "authenticated_select_makeup_exams" on makeup_exams for select to authenticated using (true);
    create policy "authenticated_insert_makeup_exams" on makeup_exams for insert to authenticated with check (true);
    create policy "authenticated_update_makeup_exams" on makeup_exams for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_makeup_exams" on makeup_exams for delete to authenticated using (true);
  end if;
end $$;

create table if not exists attendance_notes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  body text not null,
  updated_at timestamptz default now(),
  check ((student_id is not null and lesson_id is null) or (student_id is null and lesson_id is not null))
);
create unique index if not exists idx_attendance_notes_student on attendance_notes (academic_year_id, student_id) where student_id is not null;
create unique index if not exists idx_attendance_notes_lesson on attendance_notes (academic_year_id, lesson_id) where lesson_id is not null;
alter table attendance_notes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'attendance_notes' and policyname = 'authenticated_select_attendance_notes') then
    create policy "authenticated_select_attendance_notes" on attendance_notes for select to authenticated using (true);
    create policy "authenticated_insert_attendance_notes" on attendance_notes for insert to authenticated with check (true);
    create policy "authenticated_update_attendance_notes" on attendance_notes for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_attendance_notes" on attendance_notes for delete to authenticated using (true);
  end if;
end $$;

create index if not exists idx_makeup_exams_year on makeup_exams (academic_year_id);
create index if not exists idx_makeup_exams_student on makeup_exams (student_id);
create index if not exists idx_lo_gap_handling on lesson_occurrences (gap_handling);

alter table student_assignments drop column if exists teaching_type_id;
alter table teachers drop column if exists teaching_type_id;
drop table if exists teaching_types cascade;
