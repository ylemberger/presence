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
