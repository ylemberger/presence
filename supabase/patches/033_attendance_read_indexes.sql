-- Speed up attendance page reads. Does not delete rows, columns, or policies.
-- Safe to re-run (IF NOT EXISTS). No DROP / DELETE / TRUNCATE.

-- Previous meeting of the same lesson + same hour (העתק קודם, שבוע קודם).
create index if not exists idx_lo_lesson_date_number_active
  on lesson_occurrences (lesson_id, occurrence_date desc, lesson_number)
  where status is distinct from 'cancelled';

-- Roster of a lesson: who is assigned and on which dates.
create index if not exists idx_sla_lesson_covering
  on student_lesson_assignments (lesson_id)
  include (student_id, start_date, end_date, assignment_type);

-- Refresh planner stats only. Does not change data.
analyze lesson_occurrences;
analyze attendance;
analyze student_lesson_assignments;

select '033 attendance read indexes ok' as status;
