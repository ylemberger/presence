export type AttendanceStatus = "present" | "absent" | "late";
export type OccurrenceStatus = "scheduled" | "completed" | "cancelled";
export type BillingType = "mandatory" | "specialization";
export type RangeType = "annual" | "semester_a" | "semester_b" | "course";
export type AssignmentType = "automatic" | "manual";

export interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Grade {
  id: string;
  academic_year_id: string;
  name: string;
}

export interface Class {
  id: string;
  academic_year_id: string;
  grade_id: string;
  name: string;
}

export interface Track {
  id: string;
  academic_year_id: string;
  name: string;
}

export interface Specialization {
  id: string;
  academic_year_id: string;
  name: string;
}

export interface ActivityRange {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  range_type: RangeType;
}

export interface AttendanceRule {
  id: string;
  name: string;
  max_allowed_absence_percent: number;
}

export interface Student {
  id: string;
  full_name: string;
  identity_number: string;
  cohort_number: number;
  is_active: boolean;
  created_at: string;
}

export interface StudentAssignment {
  id: string;
  student_id: string;
  academic_year_id: string;
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  identity_number: string;
  phone: string;
  email: string;
  is_local: boolean;
  created_at: string;
}

export interface TeacherSourceRecord {
  id: string;
  external_id: string;
  teacher_identity_number: string;
  full_name: string;
  subject: string;
  source_year: string;
  payload: Record<string, unknown> | null;
  synced_at: string;
}

export interface TeacherTeachingAssignment {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  subject: string;
  billing_type: BillingType;
  grade_id: string | null;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  for_psychology: boolean;
  source_record_id: string | null;
}

export interface Lesson {
  id: string;
  academic_year_id: string;
  teacher_teaching_assignment_id: string;
  subject: string;
  grade_id: string;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  billing_type: BillingType;
  for_psychology: boolean;
  day_of_week: number;
  lesson_number: number;
  activity_range_id: string;
  attendance_rule_id: string;
  created_at: string;
}

export interface LessonOccurrence {
  id: string;
  lesson_id: string;
  occurrence_date: string;
  status: OccurrenceStatus;
  notes: string | null;
  gap_handling: "in_treatment" | "continued" | null;
}

export interface MakeupExam {
  id: string;
  academic_year_id: string;
  student_id: string;
  lesson_id: string;
  required_exams: number;
  completed_exams: number;
  status: "open" | "done" | "blocked";
  notes: string | null;
  created_at: string;
}

export interface AttendanceNote {
  id: string;
  academic_year_id: string;
  student_id: string | null;
  lesson_id: string | null;
  body: string;
  updated_at: string;
}

export interface StudentLessonAssignment {
  id: string;
  student_id: string;
  lesson_id: string;
  assignment_type: AssignmentType;
  start_date: string;
  end_date: string | null;
}

export interface Attendance {
  id: string;
  student_id: string;
  lesson_occurrence_id: string;
  status: AttendanceStatus;
}

export interface AttendanceChangeLog {
  id: string;
  attendance_id: string;
  changed_by: string | null;
  old_status: AttendanceStatus | null;
  new_status: AttendanceStatus;
  changed_at: string;
}

export interface Database {
  public: {
    Tables: {
      academic_years: { Row: AcademicYear; Insert: Omit<AcademicYear, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<AcademicYear> };
      grades: { Row: Grade; Insert: Omit<Grade, "id"> & { id?: string }; Update: Partial<Grade> };
      classes: { Row: Class; Insert: Omit<Class, "id"> & { id?: string }; Update: Partial<Class> };
      tracks: { Row: Track; Insert: Omit<Track, "id"> & { id?: string }; Update: Partial<Track> };
      specializations: { Row: Specialization; Insert: Omit<Specialization, "id"> & { id?: string }; Update: Partial<Specialization> };
      activity_ranges: { Row: ActivityRange; Insert: Omit<ActivityRange, "id"> & { id?: string }; Update: Partial<ActivityRange> };
      attendance_rules: { Row: AttendanceRule; Insert: Omit<AttendanceRule, "id"> & { id?: string }; Update: Partial<AttendanceRule> };
      students: { Row: Student; Insert: Omit<Student, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Student> };
      student_assignments: { Row: StudentAssignment; Insert: Omit<StudentAssignment, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<StudentAssignment> };
      teachers: { Row: Teacher; Insert: Omit<Teacher, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Teacher> };
      teacher_source_records: { Row: TeacherSourceRecord; Insert: Omit<TeacherSourceRecord, "id" | "synced_at"> & { id?: string; synced_at?: string }; Update: Partial<TeacherSourceRecord> };
      teacher_teaching_assignments: { Row: TeacherTeachingAssignment; Insert: Omit<TeacherTeachingAssignment, "id"> & { id?: string }; Update: Partial<TeacherTeachingAssignment> };
      lessons: { Row: Lesson; Insert: Omit<Lesson, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Lesson> };
      lesson_occurrences: { Row: LessonOccurrence; Insert: Omit<LessonOccurrence, "id"> & { id?: string; gap_handling?: LessonOccurrence["gap_handling"] }; Update: Partial<LessonOccurrence> };
      student_lesson_assignments: { Row: StudentLessonAssignment; Insert: Omit<StudentLessonAssignment, "id"> & { id?: string }; Update: Partial<StudentLessonAssignment> };
      attendance: { Row: Attendance; Insert: Omit<Attendance, "id"> & { id?: string }; Update: Partial<Attendance> };
      attendance_change_log: { Row: AttendanceChangeLog; Insert: Omit<AttendanceChangeLog, "id" | "changed_at"> & { id?: string; changed_at?: string }; Update: Partial<AttendanceChangeLog> };
      makeup_exams: { Row: MakeupExam; Insert: Omit<MakeupExam, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<MakeupExam> };
      attendance_notes: { Row: AttendanceNote; Insert: Omit<AttendanceNote, "id" | "updated_at"> & { id?: string; updated_at?: string }; Update: Partial<AttendanceNote> };
    };
  };
}
