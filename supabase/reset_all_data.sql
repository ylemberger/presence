-- presence: מחיקת כל הנתונים (שומר טבלאות). הרץ ב-Supabase SQL Editor.

truncate table
  attendance_change_log,
  attendance,
  attendance_notes,
  makeup_exams,
  lesson_occurrences,
  lesson_audience,
  student_lesson_assignments,
  lessons,
  teacher_teaching_assignments,
  teacher_source_records,
  student_assignments,
  students,
  teachers,
  activity_ranges,
  holiday_periods,
  classes,
  grades,
  tracks,
  specializations,
  academic_years,
  attendance_rules
restart identity cascade;
