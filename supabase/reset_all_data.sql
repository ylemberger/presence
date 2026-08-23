truncate table
  attendance_change_log,
  attendance,
  attendance_notes,
  makeup_exams,
  lesson_occurrences,
  student_lesson_assignments,
  lessons,
  teacher_teaching_assignments,
  teacher_source_records,
  student_assignments,
  students,
  teachers,
  activity_ranges,
  classes,
  grades,
  tracks,
  specializations,
  academic_years,
  attendance_rules
restart identity cascade;

insert into attendance_rules (name, max_allowed_absence_percent) values
  ('רגיל 20%', 20),
  ('בטיחות 10%', 10),
  ('עזרה ראשונה 1%', 1);
