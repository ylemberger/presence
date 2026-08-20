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
