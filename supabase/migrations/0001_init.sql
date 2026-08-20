-- Academic Years
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Grades / Layers
create table grades (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

-- Classes
create table classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  grade_id uuid references grades(id) on delete cascade,
  name text not null
);

-- Tracks
create table tracks (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

-- Specializations
create table specializations (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null
);

-- Activity Ranges (Terms/Semesters/Courses)
create table activity_ranges (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  range_type text check (range_type in ('annual', 'semester_a', 'semester_b', 'course')),
  constraint activity_ranges_dates_check check (end_date >= start_date)
);

-- Attendance Rules
create table attendance_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_allowed_absence_percent numeric(5,2) not null
);

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  identity_number text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Student Historical Assignments (Placements)
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

-- Teachers (Core Person)
create table teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  identity_number text unique not null,
  phone text,
  email text,
  is_local boolean default false,
  created_at timestamptz default now()
);

-- Mock External Source Records for Sync Testing
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

-- Teacher Teaching Assignments (Local Mapping)
create table teacher_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  academic_year_id uuid references academic_years(id) on delete cascade,
  subject text not null,
  class_id uuid references classes(id) on delete cascade,
  specialization_id uuid references specializations(id),
  source_record_id uuid references teacher_source_records(id) on delete set null
);

-- Lessons (Templates)
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

-- Lesson Occurrences (Concrete Dates)
create table lesson_occurrences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  occurrence_date date not null,
  status text check (status in ('scheduled', 'completed', 'cancelled')) default 'scheduled',
  notes text,
  unique(lesson_id, occurrence_date)
);

-- Student Lesson Assignments
create table student_lesson_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  assignment_type text check (assignment_type in ('automatic', 'manual')) default 'automatic',
  start_date date not null,
  end_date date,
  constraint student_lesson_assignments_dates_check check (end_date is null or end_date >= start_date)
);

-- Attendance Records
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  lesson_occurrence_id uuid references lesson_occurrences(id) on delete cascade,
  status text check (status in ('present', 'absent', 'late')) not null,
  unique(student_id, lesson_occurrence_id)
);

-- Attendance Change Logs (Audit Trail)
create table attendance_change_log (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance(id) on delete cascade,
  changed_by uuid,
  old_status text,
  new_status text,
  changed_at timestamptz default now()
);

-- Indexes
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

-- Only one active academic year at a time
create unique index idx_academic_years_single_active
  on academic_years (is_active)
  where is_active = true;

-- Prevent overlapping student assignments for the same student
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
    raise exception 'חפיפת שיבוצים: לתלמידה כבר קיים שיבוץ בטווח תאריכים זה';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_student_assignment_overlap
  before insert or update on student_assignments
  for each row execute function check_student_assignment_overlap();

-- Attendance change audit log trigger
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

-- Enable RLS on all tables
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

-- RLS policies: authenticated users have full access (admin-only system)
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
