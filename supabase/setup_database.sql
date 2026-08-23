-- presence: full database schema (run once in Supabase SQL Editor)

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean default false,
  created_at timestamptz default now()
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  grade_id uuid references grades(id) on delete cascade,
  name text not null
);

create table tracks (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

create table specializations (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

create table activity_ranges (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  range_type text check (range_type in ('annual', 'semester_a', 'semester_b', 'course')),
  constraint activity_ranges_dates_check check (end_date >= start_date)
);

create table attendance_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_allowed_absence_percent numeric(5,2) not null
);

create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  identity_number text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table student_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  academic_year_id uuid references academic_years(id) on delete cascade,
  grade_id uuid references grades(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  specialization_id uuid references specializations(id),
  start_date date not null,
  end_date date,
  created_at timestamptz default now(),
  constraint student_assignments_dates_check check (end_date is null or end_date >= start_date)
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  identity_number text unique not null,
  phone text,
  email text,
  is_local boolean default false,
  created_at timestamptz default now()
);

create table teacher_source_records (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  teacher_identity_number text not null,
  full_name text not null,
  subject text not null,
  source_year text not null,
  payload jsonb,
  synced_at timestamptz default now()
);

create table teacher_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  academic_year_id uuid references academic_years(id) on delete cascade,
  subject text not null,
  class_id uuid references classes(id) on delete cascade,
  specialization_id uuid references specializations(id),
  source_record_id uuid references teacher_source_records(id) on delete set null
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  teacher_teaching_assignment_id uuid references teacher_teaching_assignments(id) on delete cascade,
  subject text not null,
  grade_id uuid references grades(id) on delete cascade,
  class_id uuid references classes(id),
  track_id uuid references tracks(id),
  specialization_id uuid references specializations(id),
  billing_type text check (billing_type in ('mandatory', 'specialization')) not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  lesson_number smallint not null check (lesson_number between 1 and 9),
  activity_range_id uuid references activity_ranges(id) on delete cascade,
  attendance_rule_id uuid references attendance_rules(id) on delete set null,
  created_at timestamptz default now()
);

create table lesson_occurrences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  occurrence_date date not null,
  status text check (status in ('scheduled', 'completed', 'cancelled')) default 'scheduled',
  notes text,
  unique(lesson_id, occurrence_date)
);

create table student_lesson_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  assignment_type text check (assignment_type in ('automatic', 'manual')) default 'automatic',
  start_date date not null,
  end_date date,
  constraint student_lesson_assignments_dates_check check (end_date is null or end_date >= start_date)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  lesson_occurrence_id uuid references lesson_occurrences(id) on delete cascade,
  status text check (status in ('present', 'absent', 'late')) not null,
  reason text check (
    reason is null or reason in ('illness', 'permission', 'family', 'unexcused')
  ),
  unique(student_id, lesson_occurrence_id)
);

create table attendance_change_log (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance(id) on delete cascade,
  changed_by uuid,
  old_status text,
  new_status text,
  changed_at timestamptz default now()
);

create index idx_grades_academic_year on grades(academic_year_id);
create index idx_classes_academic_year on classes(academic_year_id);
create index idx_classes_grade on classes(grade_id);
create index idx_tracks_academic_year on tracks(academic_year_id);
create index idx_specializations_academic_year on specializations(academic_year_id);
create index idx_activity_ranges_academic_year on activity_ranges(academic_year_id);
create index idx_student_assignments_student on student_assignments(student_id);
create index idx_student_assignments_year on student_assignments(academic_year_id);
create index idx_student_assignments_dates on student_assignments(start_date, end_date);
create index idx_teacher_teaching_assignments_teacher on teacher_teaching_assignments(teacher_id);
create index idx_teacher_teaching_assignments_year on teacher_teaching_assignments(academic_year_id);
create index idx_lessons_academic_year on lessons(academic_year_id);
create index idx_lesson_occurrences_date on lesson_occurrences(occurrence_date);
create index idx_lesson_occurrences_lesson on lesson_occurrences(lesson_id);
create index idx_student_lesson_assignments_student on student_lesson_assignments(student_id);
create index idx_student_lesson_assignments_lesson on student_lesson_assignments(lesson_id);
create index idx_attendance_student on attendance(student_id);
create index idx_attendance_occurrence on attendance(lesson_occurrence_id);

create unique index idx_academic_years_single_active
  on academic_years (is_active)
  where is_active = true;

create or replace function check_student_assignment_overlap()
returns trigger as $$
begin
  if exists (
    select 1 from student_assignments sa
    where sa.student_id = new.student_id
      and sa.id is distinct from new.id
      and sa.start_date <= coalesce(new.end_date, '9999-12-31'::date)
      and coalesce(sa.end_date, '9999-12-31'::date) >= new.start_date
  ) then
    raise exception '׳—׳₪׳™׳₪׳× ׳©׳™׳‘׳•׳¦׳™׳: ׳׳×׳׳׳™׳“׳” ׳›׳‘׳¨ ׳§׳™׳™׳ ׳©׳™׳‘׳•׳¥ ׳‘׳˜׳•׳•׳— ׳×׳׳¨׳™׳›׳™׳ ׳–׳”';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_student_assignment_overlap
  before insert or update on student_assignments
  for each row execute function check_student_assignment_overlap();

create or replace function log_attendance_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into attendance_change_log (attendance_id, changed_by, old_status, new_status)
    values (new.id, auth.uid(), null, new.status);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into attendance_change_log (attendance_id, changed_by, old_status, new_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_attendance_change_log
  after insert or update on attendance
  for each row execute function log_attendance_change();

alter table academic_years enable row level security;
alter table grades enable row level security;
alter table classes enable row level security;
alter table tracks enable row level security;
alter table specializations enable row level security;
alter table activity_ranges enable row level security;
alter table attendance_rules enable row level security;
alter table students enable row level security;
alter table student_assignments enable row level security;
alter table teachers enable row level security;
alter table teacher_source_records enable row level security;
alter table teacher_teaching_assignments enable row level security;
alter table lessons enable row level security;
alter table lesson_occurrences enable row level security;
alter table student_lesson_assignments enable row level security;
alter table attendance enable row level security;
alter table attendance_change_log enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'academic_years', 'grades', 'classes', 'tracks', 'specializations',
    'activity_ranges', 'attendance_rules', 'students', 'student_assignments',
    'teachers', 'teacher_source_records', 'teacher_teaching_assignments',
    'lessons', 'lesson_occurrences', 'student_lesson_assignments',
    'attendance', 'attendance_change_log'
  ]
  loop
    execute format('create policy "authenticated_select_%s" on %I for select to authenticated using (true)', tbl, tbl);
    execute format('create policy "authenticated_insert_%s" on %I for insert to authenticated with check (true)', tbl, tbl);
    execute format('create policy "authenticated_update_%s" on %I for update to authenticated using (true) with check (true)', tbl, tbl);
    execute format('create policy "authenticated_delete_%s" on %I for delete to authenticated using (true)', tbl, tbl);
  end loop;
end $$;


create extension if not exists btree_gist;
create extension if not exists pg_trgm;

create index if not exists idx_students_active_name
  on students (full_name)
  where is_active = true;

create index if not exists idx_students_full_name
  on students (full_name);

create index if not exists idx_students_full_name_trgm
  on students using gin (full_name gin_trgm_ops);

create index if not exists idx_teachers_full_name
  on teachers (full_name);

create index if not exists idx_teachers_full_name_trgm
  on teachers using gin (full_name gin_trgm_ops);

create index if not exists idx_teachers_email
  on teachers (email)
  where email is not null;

create index if not exists idx_teacher_source_records_year
  on teacher_source_records (source_year);

create index if not exists idx_teacher_source_records_identity
  on teacher_source_records (teacher_identity_number);

create index if not exists idx_student_assignments_current_class
  on student_assignments (academic_year_id, class_id, student_id)
  where end_date is null;

create index if not exists idx_student_assignments_current_year
  on student_assignments (academic_year_id, student_id)
  where end_date is null;

create index if not exists idx_student_assignments_student_year
  on student_assignments (student_id, academic_year_id, start_date desc);

create index if not exists idx_student_assignments_grade
  on student_assignments (grade_id);

create index if not exists idx_student_assignments_class
  on student_assignments (class_id);

create index if not exists idx_student_assignments_track
  on student_assignments (track_id);

create index if not exists idx_student_assignments_specialization
  on student_assignments (specialization_id)
  where specialization_id is not null;

create index if not exists idx_student_assignments_overlap
  on student_assignments
  using gist (
    student_id,
    daterange(start_date, end_date, '[]')
  );

create index if not exists idx_lessons_year_day
  on lessons (academic_year_id, day_of_week, lesson_number);

create index if not exists idx_lessons_class
  on lessons (class_id)
  where class_id is not null;

create index if not exists idx_lessons_grade
  on lessons (grade_id);

create index if not exists idx_lessons_track
  on lessons (track_id)
  where track_id is not null;

create index if not exists idx_lessons_specialization
  on lessons (specialization_id)
  where specialization_id is not null;

create index if not exists idx_lessons_activity_range
  on lessons (activity_range_id);

create index if not exists idx_lessons_attendance_rule
  on lessons (attendance_rule_id)
  where attendance_rule_id is not null;

create index if not exists idx_lessons_teacher_assignment
  on lessons (teacher_teaching_assignment_id);

create index if not exists idx_lesson_occurrences_week
  on lesson_occurrences (occurrence_date, lesson_id)
  include (status)
  where status in ('scheduled', 'completed');

create index if not exists idx_lesson_occurrences_status_date
  on lesson_occurrences (status, occurrence_date);

create index if not exists idx_attendance_occurrence_student
  on attendance (lesson_occurrence_id, student_id)
  include (status);

create index if not exists idx_sla_student_lesson_dates
  on student_lesson_assignments (student_id, lesson_id, start_date, end_date);

create index if not exists idx_sla_lesson_dates
  on student_lesson_assignments (lesson_id, start_date, end_date);

create index if not exists idx_lesson_occurrences_date_status
  on lesson_occurrences (occurrence_date, status);

create index if not exists idx_sla_overlap
  on student_lesson_assignments
  using gist (
    student_id,
    lesson_id,
    daterange(start_date, end_date, '[]')
  );

create index if not exists idx_teacher_assignments_year_teacher
  on teacher_teaching_assignments (academic_year_id, teacher_id);

create index if not exists idx_teacher_assignments_class
  on teacher_teaching_assignments (class_id);

create index if not exists idx_teacher_assignments_specialization
  on teacher_teaching_assignments (specialization_id)
  where specialization_id is not null;

create index if not exists idx_teacher_assignments_source
  on teacher_teaching_assignments (source_record_id)
  where source_record_id is not null;

create index if not exists idx_teacher_assignments_lookup
  on teacher_teaching_assignments (teacher_id, academic_year_id, subject);

create index if not exists idx_activity_ranges_dates
  on activity_ranges (academic_year_id, start_date, end_date);

create index if not exists idx_attendance_change_log_attendance
  on attendance_change_log (attendance_id, changed_at desc);

create index if not exists idx_attendance_change_log_changed_at
  on attendance_change_log (changed_at desc);

analyze academic_years;
analyze grades;
analyze classes;
analyze tracks;
analyze specializations;
analyze activity_ranges;
analyze attendance_rules;
analyze students;
analyze student_assignments;
analyze teachers;
analyze teacher_source_records;
analyze teacher_teaching_assignments;
analyze lessons;
analyze lesson_occurrences;
analyze student_lesson_assignments;
analyze attendance;
analyze attendance_change_log;


-- Business rules: required FKs, billing logic, attendance rule mandatory

-- Normalize existing lesson billing scopes before enforcing check
update lessons
set class_id = null, track_id = null
where billing_type = 'specialization'
  and specialization_id is not null;

update lessons
set specialization_id = null
where billing_type = 'mandatory';

-- Ensure every lesson has an attendance rule
update lessons
set attendance_rule_id = (
  select id from attendance_rules order by name limit 1
)
where attendance_rule_id is null
  and exists (select 1 from attendance_rules);

delete from lessons
where attendance_rule_id is null;

alter table lessons
  drop constraint if exists lessons_attendance_rule_id_fkey;

alter table lessons
  add constraint lessons_attendance_rule_id_fkey
  foreign key (attendance_rule_id) references attendance_rules(id);

alter table lessons
  alter column attendance_rule_id set not null;

alter table lessons
  drop constraint if exists lessons_billing_scope_check;

alter table lessons
  add constraint lessons_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (class_id is not null or track_id is not null)
    )
  );

-- Teachers: fill blanks/short values then require contact fields
update teachers
set phone = '0500000000'
where phone is null or length(trim(phone)) < 9;

update teachers
set email = coalesce(
  nullif(trim(email), ''),
  identity_number || '@local.invalid'
)
where email is null or length(trim(email)) = 0;

update teachers
set email = identity_number || '@local.invalid'
where email is not null and email !~* '^[^@]+@[^@]+\.[^@]+$';

alter table teachers
  alter column phone set not null,
  alter column email set not null;

alter table teachers
  drop constraint if exists teachers_email_format_check;

alter table teachers
  add constraint teachers_email_format_check
  check (email ~* '^[^@]+@[^@]+\.[^@]+$');

alter table teachers
  drop constraint if exists teachers_phone_not_blank_check;

alter table teachers
  add constraint teachers_phone_not_blank_check
  check (length(trim(phone)) >= 9);

create index if not exists idx_students_identity_number on students (identity_number);
create index if not exists idx_teachers_identity_number on teachers (identity_number);
create index if not exists idx_lessons_attendance_rule on lessons (attendance_rule_id);
create index if not exists idx_lessons_billing_type on lessons (billing_type);


-- Teaching assignments: ׳—׳•׳‘׳”/׳”׳×׳׳—׳•׳× like lessons (class OR track OR specialization)

alter table teacher_teaching_assignments
  add column if not exists track_id uuid references tracks(id);

alter table teacher_teaching_assignments
  add column if not exists billing_type text;

-- Backfill existing rows as mandatory with class
update teacher_teaching_assignments
set billing_type = case
  when specialization_id is not null and class_id is null then 'specialization'
  else 'mandatory'
end
where billing_type is null;

-- Specialization rows: clear class/track
update teacher_teaching_assignments
set class_id = null, track_id = null
where billing_type = 'specialization';

-- Mandatory rows: clear specialization
update teacher_teaching_assignments
set specialization_id = null
where billing_type = 'mandatory';

-- Rows that still can't satisfy the rule: keep class if present, else delete orphan
delete from teacher_teaching_assignments
where billing_type = 'mandatory'
  and class_id is null
  and track_id is null;

delete from teacher_teaching_assignments
where billing_type = 'specialization'
  and specialization_id is null;

alter table teacher_teaching_assignments
  alter column billing_type set not null;

alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_billing_type_check;

alter table teacher_teaching_assignments
  add constraint teacher_teaching_assignments_billing_type_check
  check (billing_type in ('mandatory', 'specialization'));

alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_scope_check;

alter table teacher_teaching_assignments
  add constraint teacher_teaching_assignments_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (class_id is not null or track_id is not null)
    )
  );

create index if not exists idx_tta_track on teacher_teaching_assignments (track_id);
create index if not exists idx_tta_billing on teacher_teaching_assignments (billing_type);


-- Teaching assignments: grade scope + clarify classגˆ©track matching in app

alter table teacher_teaching_assignments
  add column if not exists grade_id uuid references grades(id);

-- Backfill grade from linked class when possible
update teacher_teaching_assignments tta
set grade_id = c.grade_id
from classes c
where tta.class_id = c.id
  and tta.grade_id is null;

create index if not exists idx_tta_grade on teacher_teaching_assignments (grade_id);


-- Hot-path indexes for attendance / auto-assign / occurrences

create index if not exists idx_sla_lesson_open
  on student_lesson_assignments (lesson_id)
  where end_date is null;

create index if not exists idx_sla_student_open
  on student_lesson_assignments (student_id)
  where end_date is null;

create index if not exists idx_student_assignments_year_open
  on student_assignments (academic_year_id)
  where end_date is null;

create index if not exists idx_lessons_year_day
  on lessons (academic_year_id, day_of_week);

create index if not exists idx_attendance_occurrence_student
  on attendance (lesson_occurrence_id, student_id);


-- Student extras, teaching types, psychology lessons, cohorts, fixed grades ׳/׳‘/׳’

-- Cohort stays on the student across years
alter table students
  add column if not exists cohort_number integer;

update students set cohort_number = 1 where cohort_number is null;

alter table students
  alter column cohort_number set not null,
  alter column cohort_number set default 1;

alter table students
  drop constraint if exists students_cohort_positive;
alter table students
  add constraint students_cohort_positive check (cohort_number >= 1);

alter table student_assignments
  add column if not exists secondary_specialization_id uuid references specializations(id),
  add column if not exists is_psychology boolean;

update student_assignments set is_psychology = false where is_psychology is null;

alter table student_assignments
  alter column is_psychology set not null,
  alter column is_psychology set default false;

alter table teacher_teaching_assignments
  add column if not exists for_psychology boolean;

update teacher_teaching_assignments set for_psychology = false where for_psychology is null;

alter table teacher_teaching_assignments
  alter column for_psychology set not null,
  alter column for_psychology set default false;

alter table lessons
  add column if not exists for_psychology boolean;

update lessons set for_psychology = false where for_psychology is null;

alter table lessons
  alter column for_psychology set not null,
  alter column for_psychology set default false;

-- Mandatory: class/track OR psychology destination
alter table lessons drop constraint if exists lessons_billing_scope_check;
alter table lessons
  add constraint lessons_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (
        for_psychology = true
        or class_id is not null
        or track_id is not null
      )
    )
  );

-- Same rule for teaching assignments (soft check via app; DB for consistency)
alter table teacher_teaching_assignments
  drop constraint if exists tta_billing_scope_check;
alter table teacher_teaching_assignments
  add constraint tta_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (
        for_psychology = true
        or class_id is not null
        or track_id is not null
      )
    )
  );

create index if not exists idx_students_cohort on students (cohort_number);
create index if not exists idx_sa_secondary_spec on student_assignments (secondary_specialization_id);
create index if not exists idx_lessons_psychology on lessons (for_psychology);

-- Ensure each existing year has grades ׳ ׳‘ ׳’
insert into grades (academic_year_id, name)
select y.id, g.name
from academic_years y
cross join (values ('׳'), ('׳‘'), ('׳’')) as g(name)
where not exists (
  select 1 from grades existing
  where existing.academic_year_id = y.id and existing.name = g.name
);



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


alter table student_assignments drop column if exists teaching_type_id;
alter table teachers drop column if exists teaching_type_id;
drop table if exists teaching_types cascade;

