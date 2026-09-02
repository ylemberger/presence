-- =============================================================================
-- presence — קובץ יחיד למסד קיים (Supabase SQL Editor)
-- =============================================================================
-- מתי להריץ: פעם אחת על מסד שכבר קיים (לא פרויקט חדש).
-- לפרויקט חדש לגמרי: הריצי רק setup_database.sql (לא את הקובץ הזה).
--
-- מה כלול כאן (בטוח להרצה חוזרת — idempotent):
--   • חופשות / ביטול לימודים + kind
--   • קהל מרובה לשיעור (כולל שכבות מרובות), period_count
--   • סיבת היעדרות, gap_handling, attendance_notes
--   • סנכרון מורות משכר
--   • שדות תלמידה מורחבים (שם פרטי/משפחה, טלפונים, כתובת, ת.ל., תיכון, חץ…)
--   • מקצועות (הורה לשיעורים) + חישוב נוכחות לפי מקצוע
--
-- חשוב ללוגיקה:
--   כיתה / מסלול / התמחות / פסיכולוגיה נשארים ב-student_assignments (לפי שנה).
--   על students נשמרים רק פרטים קבועים של הכרטסת.
-- =============================================================================

-- ---------- אופציונלי: מחיקת תלמידות בלבד (חד־פעמי) ----------
-- הסירי את ההערות משלוש השורות הבאות אם רוצים לנקות תלמידות ולהתחיל מחדש:
-- delete from attendance_change_log where attendance_id in (select id from attendance);
-- delete from attendance;
-- delete from students;  -- cascade: שיבוצים, שיוך לשיעורים, הערות תלמידה וכו'

-- ========== חופשות ==========
create table if not exists holiday_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  constraint holiday_periods_dates_check check (end_date >= start_date)
);

create index if not exists idx_holiday_periods_academic_year
  on holiday_periods (academic_year_id);
create index if not exists idx_holiday_periods_dates
  on holiday_periods (academic_year_id, start_date, end_date);

alter table holiday_periods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'holiday_periods' and policyname = 'authenticated_select_holiday_periods'
  ) then
    create policy "authenticated_select_holiday_periods" on holiday_periods for select to authenticated using (true);
    create policy "authenticated_insert_holiday_periods" on holiday_periods for insert to authenticated with check (true);
    create policy "authenticated_update_holiday_periods" on holiday_periods for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_holiday_periods" on holiday_periods for delete to authenticated using (true);
  end if;
end $$;

alter table holiday_periods add column if not exists kind text;
update holiday_periods set kind = 'vacation' where kind is null;
alter table holiday_periods drop constraint if exists holiday_periods_kind_check;
alter table holiday_periods
  alter column kind set default 'vacation',
  alter column kind set not null;
alter table holiday_periods
  add constraint holiday_periods_kind_check
  check (kind in ('vacation', 'cancelled_studies'));

-- ========== קהל מרובה לשיעור ==========
create table if not exists lesson_audience (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  grade_id uuid references grades(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  specialization_id uuid references specializations(id) on delete cascade,
  created_at timestamptz default now()
);

alter table lesson_audience
  add column if not exists grade_id uuid references grades(id) on delete cascade;

alter table lesson_audience drop constraint if exists lesson_audience_one_target;
alter table lesson_audience
  add constraint lesson_audience_one_target check (
    (class_id is not null)::int
    + (track_id is not null)::int
    + (specialization_id is not null)::int
    + (grade_id is not null)::int = 1
  );

create index if not exists idx_lesson_audience_lesson on lesson_audience (lesson_id);
create unique index if not exists idx_lesson_audience_grade
  on lesson_audience (lesson_id, grade_id)
  where grade_id is not null;

alter table lesson_audience enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lesson_audience' and policyname = 'authenticated_select_lesson_audience'
  ) then
    create policy "authenticated_select_lesson_audience" on lesson_audience for select to authenticated using (true);
    create policy "authenticated_insert_lesson_audience" on lesson_audience for insert to authenticated with check (true);
    create policy "authenticated_update_lesson_audience" on lesson_audience for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_lesson_audience" on lesson_audience for delete to authenticated using (true);
  end if;
end $$;

-- ========== שעות רצופות ==========
alter table lessons add column if not exists period_count integer;
update lessons set period_count = 1 where period_count is null;
alter table lessons alter column period_count set default 1;
alter table lessons alter column period_count set not null;
alter table lessons drop constraint if exists lessons_period_count_check;
alter table lessons add constraint lessons_period_count_check check (period_count >= 1 and period_count <= 9);

-- ========== סיבת היעדרות ==========
alter table attendance drop constraint if exists attendance_reason_check;
alter table attendance add column if not exists reason text;
alter table attendance drop constraint if exists attendance_reason_check;
alter table attendance add constraint attendance_reason_check check (
  reason is null or reason in ('illness', 'permission', 'family', 'unexcused')
);

-- ========== טיפול בפער נוכחות ==========
alter table lesson_occurrences add column if not exists gap_handling text;
alter table lesson_occurrences drop constraint if exists lesson_occurrences_gap_handling_check;
alter table lesson_occurrences add constraint lesson_occurrences_gap_handling_check check (
  gap_handling is null or gap_handling in ('in_treatment', 'continued')
);
create index if not exists idx_lo_gap_handling on lesson_occurrences (gap_handling);

-- ========== הערות נוכחות (שיעור / תלמידה) ==========
create table if not exists attendance_notes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz default now(),
  constraint attendance_notes_one_target check (
    (lesson_id is not null and student_id is null)
    or (lesson_id is null and student_id is not null)
  )
);

create unique index if not exists idx_attendance_notes_student
  on attendance_notes (academic_year_id, student_id) where student_id is not null;
create unique index if not exists idx_attendance_notes_lesson
  on attendance_notes (academic_year_id, lesson_id) where lesson_id is not null;

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

-- ========== סנכרון מורות משכר ==========
alter table teacher_source_records
  add column if not exists teacher_id uuid references teachers(id) on delete restrict;
alter table teacher_source_records add column if not exists salary_subject text;
alter table teacher_source_records add column if not exists salary_track text;
alter table teacher_source_records add column if not exists salary_grade_year text;
alter table teacher_source_records add column if not exists salary_semester text;
alter table teacher_source_records add column if not exists salary_meetings integer;
create index if not exists idx_teacher_source_records_teacher
  on teacher_source_records (teacher_id);

-- ========== שיבוץ: התמחות נוספת + פסיכולוגיה ==========
alter table student_assignments
  add column if not exists secondary_specialization_id uuid references specializations(id);
alter table student_assignments add column if not exists is_psychology boolean;
update student_assignments set is_psychology = false where is_psychology is null;
alter table student_assignments
  alter column is_psychology set default false,
  alter column is_psychology set not null;

-- ========== כרטסת תלמידה מורחבת ==========
alter table students add column if not exists cohort_number integer;
update students set cohort_number = 1 where cohort_number is null;
alter table students
  alter column cohort_number set default 1,
  alter column cohort_number set not null;
alter table students drop constraint if exists students_cohort_positive;
alter table students add constraint students_cohort_positive check (cohort_number >= 1);

alter table students add column if not exists personal_note text;

alter table students add column if not exists mi text;
alter table students add column if not exists first_name text;
alter table students add column if not exists last_name text;
alter table students add column if not exists birth_date date;
alter table students add column if not exists birth_date_hebrew text;
alter table students add column if not exists address text;
alter table students add column if not exists city text;
alter table students add column if not exists phone text;
alter table students add column if not exists father_phone text;
alter table students add column if not exists mother_phone text;
alter table students add column if not exists student_phone text;
alter table students add column if not exists high_school text;
alter table students add column if not exists chetz_program boolean;

update students set chetz_program = false where chetz_program is null;
alter table students
  alter column chetz_program set default false,
  alter column chetz_program set not null;

-- פיצול שם מלא קיים (חד־פעמי לשורות שעדיין בלי first/last)
update students
set
  first_name = coalesce(
    nullif(trim(first_name), ''),
    nullif(split_part(trim(full_name), ' ', 1), ''),
    trim(full_name)
  ),
  last_name = coalesce(
    nullif(trim(last_name), ''),
    nullif(trim(substring(trim(full_name) from position(' ' in trim(full_name) || ' ') + 1)), ''),
    ''
  )
where first_name is null or last_name is null;

alter table students alter column first_name set default '';
alter table students alter column last_name set default '';
update students set first_name = coalesce(first_name, '') where first_name is null;
update students set last_name = coalesce(last_name, '') where last_name is null;

create index if not exists idx_students_last_name on students (last_name);
create index if not exists idx_students_city on students (city);

comment on column students.mi is 'עמודת «מי» מהאקסל (סימון קצר חופשי)';
comment on column students.chetz_program is 'תוכנית חץ';
comment on column students.birth_date_hebrew is 'תאריך לידה עברי כטקסט חופשי';

-- ========== מקצועות (הורה לשיעורים) ==========
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  unique (academic_year_id, name)
);

create index if not exists idx_subjects_academic_year
  on subjects (academic_year_id);

alter table subjects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subjects' and policyname = 'authenticated_select_subjects'
  ) then
    create policy "authenticated_select_subjects" on subjects for select to authenticated using (true);
    create policy "authenticated_insert_subjects" on subjects for insert to authenticated with check (true);
    create policy "authenticated_update_subjects" on subjects for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_subjects" on subjects for delete to authenticated using (true);
  end if;
end $$;

alter table lessons
  add column if not exists subject_id uuid references subjects(id);

insert into subjects (academic_year_id, name)
select distinct academic_year_id, trim(subject)
from lessons
where subject is not null and trim(subject) <> ''
on conflict (academic_year_id, name) do nothing;

update lessons l
set subject_id = s.id
from subjects s
where l.subject_id is null
  and s.academic_year_id = l.academic_year_id
  and s.name = trim(l.subject);

alter table lessons
  alter column subject_id set not null;

create index if not exists idx_lessons_subject_id on lessons (subject_id);

alter table makeup_exams
  add column if not exists subject_id uuid references subjects(id);

update makeup_exams m
set subject_id = l.subject_id
from lessons l
where m.subject_id is null
  and l.id = m.lesson_id;

delete from makeup_exams a
using makeup_exams b
where a.subject_id is not null
  and b.subject_id is not null
  and a.student_id = b.student_id
  and a.subject_id = b.subject_id
  and a.created_at < b.created_at;

delete from makeup_exams a
using makeup_exams b
where a.subject_id is not null
  and b.subject_id is not null
  and a.student_id = b.student_id
  and a.subject_id = b.subject_id
  and a.id < b.id;

delete from makeup_exams where subject_id is null;

alter table makeup_exams drop constraint if exists makeup_exams_student_id_lesson_id_key;

create unique index if not exists makeup_exams_student_subject_uidx
  on makeup_exams (student_id, subject_id);

alter table makeup_exams
  alter column subject_id set not null;

create index if not exists idx_makeup_exams_subject on makeup_exams (subject_id);

-- Presence project only (never the salary database).
notify pgrst, 'reload schema';

-- סיום
select 'RUN_ME.sql completed' as status;
