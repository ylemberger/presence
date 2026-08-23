-- Performance indexes for attendance month views and eligibility checks.
-- Safe to re-run (IF NOT EXISTS).

create index if not exists idx_lesson_occurrences_date_status
  on lesson_occurrences (occurrence_date, status);

create index if not exists idx_student_lesson_assignments_lesson_dates
  on student_lesson_assignments (lesson_id, start_date, end_date);

create index if not exists idx_attendance_occurrence_status
  on attendance (lesson_occurrence_id, status);

analyze lesson_occurrences;
analyze student_lesson_assignments;
analyze attendance;
