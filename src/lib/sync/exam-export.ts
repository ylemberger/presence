import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/paged";

export type ExamSyncBundle = {
  exportedAt: string;
  academicYears: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
  grades: Array<{ id: string; academic_year_id: string; name: string }>;
  classes: Array<{
    id: string;
    academic_year_id: string;
    grade_id: string;
    name: string;
  }>;
  tracks: Array<{ id: string; academic_year_id: string; name: string }>;
  specializations: Array<{ id: string; academic_year_id: string; name: string }>;
  subjects: Array<{ id: string; academic_year_id: string; name: string }>;
  teachers: Array<{
    id: string;
    full_name: string;
    identity_number: string;
    phone: string | null;
    email: string | null;
    is_local: boolean;
  }>;
  lessons: Array<{
    id: string;
    academic_year_id: string;
    subject_id: string;
    subject: string;
    teacher_id: string | null;
    teacher_full_name: string | null;
    teacher_identity_number: string | null;
    grade_id: string | null;
    class_id: string | null;
    track_id: string | null;
    specialization_id: string | null;
    billing_type: string;
    for_psychology: boolean;
    day_of_week: number;
    lesson_number: number;
    period_count: number;
    repeat_every_weeks: number;
  }>;
  students: Array<{
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    mi: string | null;
    identity_number: string;
    cohort_number: number;
    is_active: boolean;
    chetz_program: boolean;
    city: string | null;
  }>;
  studentAssignments: Array<{
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
  }>;
};

/**
 * Read-only snapshot for the exams system.
 * Omits attendance, notes, phones of parents, and salary source rows.
 */
export async function buildExamSyncBundle(
  supabase: SupabaseClient
): Promise<ExamSyncBundle> {
  const [
    academicYears,
    grades,
    classes,
    tracks,
    specializations,
    subjects,
    teachers,
    lessonRows,
    students,
    studentAssignments,
  ] = await Promise.all([
    fetchAllPages<{ id: string; name: string; is_active: boolean }>((from, to) =>
      supabase
        .from("academic_years")
        .select("id, name, is_active")
        .order("name")
        .range(from, to)
    ),
    fetchAllPages<{ id: string; academic_year_id: string; name: string }>((from, to) =>
      supabase.from("grades").select("id, academic_year_id, name").range(from, to)
    ),
    fetchAllPages<{
      id: string;
      academic_year_id: string;
      grade_id: string;
      name: string;
    }>((from, to) =>
      supabase
        .from("classes")
        .select("id, academic_year_id, grade_id, name")
        .range(from, to)
    ),
    fetchAllPages<{ id: string; academic_year_id: string; name: string }>((from, to) =>
      supabase.from("tracks").select("id, academic_year_id, name").range(from, to)
    ),
    fetchAllPages<{ id: string; academic_year_id: string; name: string }>((from, to) =>
      supabase
        .from("specializations")
        .select("id, academic_year_id, name")
        .range(from, to)
    ),
    fetchAllPages<{ id: string; academic_year_id: string; name: string }>((from, to) =>
      supabase.from("subjects").select("id, academic_year_id, name").range(from, to)
    ),
    fetchAllPages<{
      id: string;
      full_name: string;
      identity_number: string;
      phone: string | null;
      email: string | null;
      is_local: boolean;
    }>((from, to) =>
      supabase
        .from("teachers")
        .select("id, full_name, identity_number, phone, email, is_local")
        .order("full_name")
        .range(from, to)
    ),
    fetchAllPages<{
      id: string;
      academic_year_id: string;
      subject_id: string;
      subject: string;
      grade_id: string | null;
      class_id: string | null;
      track_id: string | null;
      specialization_id: string | null;
      billing_type: string;
      for_psychology: boolean | null;
      day_of_week: number;
      lesson_number: number;
      period_count: number | null;
      repeat_every_weeks: number | null;
      teacher_teaching_assignments: unknown;
    }>((from, to) =>
      supabase
        .from("lessons")
        .select(
          "id, academic_year_id, subject_id, subject, grade_id, class_id, track_id, specialization_id, billing_type, for_psychology, day_of_week, lesson_number, period_count, repeat_every_weeks, teacher_teaching_assignments(teacher_id, teachers(id, full_name, identity_number))"
        )
        .order("subject")
        .range(from, to)
    ),
    fetchAllPages<{
      id: string;
      full_name: string;
      first_name: string;
      last_name: string;
      mi: string | null;
      identity_number: string;
      cohort_number: number;
      is_active: boolean | null;
      chetz_program: boolean | null;
      city: string | null;
    }>((from, to) =>
      supabase
        .from("students")
        .select(
          "id, full_name, first_name, last_name, mi, identity_number, cohort_number, is_active, chetz_program, city"
        )
        .order("full_name")
        .range(from, to)
    ),
    fetchAllPages<{
      id: string;
      student_id: string;
      academic_year_id: string;
      grade_id: string;
      class_id: string;
      track_id: string;
      specialization_id: string | null;
      secondary_specialization_id: string | null;
      is_psychology: boolean | null;
      start_date: string;
      end_date: string | null;
    }>((from, to) =>
      supabase
        .from("student_assignments")
        .select(
          "id, student_id, academic_year_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date, end_date"
        )
        .range(from, to)
    ),
  ]);

  function one<T>(v: unknown): T | null {
    if (!v) return null;
    return (Array.isArray(v) ? v[0] : v) as T;
  }

  const lessons = lessonRows.map((row) => {
    const tta = one<{
      teacher_id: string;
      teachers: unknown;
    }>(row.teacher_teaching_assignments);
    const teacher = one<{
      id: string;
      full_name: string;
      identity_number: string;
    }>(tta?.teachers);
    return {
      id: row.id,
      academic_year_id: row.academic_year_id,
      subject_id: row.subject_id,
      subject: row.subject,
      teacher_id: teacher?.id ?? tta?.teacher_id ?? null,
      teacher_full_name: teacher?.full_name ?? null,
      teacher_identity_number: teacher?.identity_number ?? null,
      grade_id: row.grade_id,
      class_id: row.class_id,
      track_id: row.track_id,
      specialization_id: row.specialization_id,
      billing_type: row.billing_type,
      for_psychology: Boolean(row.for_psychology),
      day_of_week: row.day_of_week,
      lesson_number: row.lesson_number,
      period_count: row.period_count ?? 1,
      repeat_every_weeks: row.repeat_every_weeks === 2 ? 2 : 1,
    };
  });

  return {
    exportedAt: new Date().toISOString(),
    academicYears,
    grades,
    classes,
    tracks,
    specializations,
    subjects,
    teachers,
    lessons,
    students: students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      first_name: s.first_name,
      last_name: s.last_name,
      mi: s.mi,
      identity_number: s.identity_number,
      cohort_number: s.cohort_number,
      is_active: s.is_active !== false,
      chetz_program: Boolean(s.chetz_program),
      city: s.city,
    })),
    studentAssignments: studentAssignments.map((a) => ({
      id: a.id,
      student_id: a.student_id,
      academic_year_id: a.academic_year_id,
      grade_id: a.grade_id,
      class_id: a.class_id,
      track_id: a.track_id,
      specialization_id: a.specialization_id,
      secondary_specialization_id: a.secondary_specialization_id,
      is_psychology: Boolean(a.is_psychology),
      start_date: String(a.start_date).slice(0, 10),
      end_date: a.end_date ? String(a.end_date).slice(0, 10) : null,
    })),
  };
}
