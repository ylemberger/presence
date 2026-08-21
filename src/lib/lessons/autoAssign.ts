import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso } from "@/lib/dates/hebrew";

export type LessonScope = {
  id: string;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  billing_type: string;
  grade_id: string;
  for_psychology?: boolean;
};

export type Placement = {
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id?: string | null;
  grade_id: string;
  is_psychology?: boolean;
};

export function studentMatchesLesson(placement: Placement, lesson: LessonScope): boolean {
  if (lesson.grade_id && lesson.grade_id !== placement.grade_id) {
    return false;
  }

  if (lesson.for_psychology) {
    return Boolean(placement.is_psychology);
  }

  if (lesson.billing_type === "specialization") {
    if (!lesson.specialization_id) return false;
    return (
      placement.specialization_id === lesson.specialization_id ||
      placement.secondary_specialization_id === lesson.specialization_id
    );
  }

  const classOk = !lesson.class_id || lesson.class_id === placement.class_id;
  const trackOk = !lesson.track_id || lesson.track_id === placement.track_id;
  return classOk && trackOk && Boolean(lesson.class_id || lesson.track_id);
}

export function lessonMismatchMessage(placement: Placement, lesson: LessonScope): string | null {
  if (studentMatchesLesson(placement, lesson)) return null;
  if (lesson.for_psychology) {
    return "השיעור מיועד לפסיכולוגיה והתלמידה אינה מסומנת כפסיכולוגיה.";
  }
  return "התלמידה לא אמורה להיות בשיעור הזה לפי השכבה/כיתה/מסלול/התמחות שלה.";
}

function placementFromRow(p: {
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id?: string | null;
  grade_id: string;
  is_psychology?: boolean;
}): Placement {
  return {
    class_id: p.class_id,
    track_id: p.track_id,
    specialization_id: p.specialization_id,
    secondary_specialization_id: p.secondary_specialization_id ?? null,
    grade_id: p.grade_id,
    is_psychology: Boolean(p.is_psychology),
  };
}

export async function autoAssignStudentsToLesson(
  lessonId: string,
  academicYearId: string,
  startDate?: string
) {
  const supabase = await createClient();
  const effectiveFrom = startDate || todayIso();

  const [{ data: lesson }, { data: placements }, { data: existingLinks }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology"
      )
      .eq("id", lessonId)
      .single(),
    supabase
      .from("student_assignments")
      .select(
        "student_id, class_id, track_id, specialization_id, secondary_specialization_id, grade_id, is_psychology"
      )
      .eq("academic_year_id", academicYearId)
      .is("end_date", null),
    supabase
      .from("student_lesson_assignments")
      .select("student_id")
      .eq("lesson_id", lessonId)
      .is("end_date", null),
  ]);

  if (!lesson) return { assigned: 0 };

  const already = new Set((existingLinks ?? []).map((r) => r.student_id));
  const rows = (placements ?? [])
    .filter((p) => studentMatchesLesson(placementFromRow(p), lesson))
    .filter((p) => !already.has(p.student_id))
    .map((p) => ({
      student_id: p.student_id,
      lesson_id: lessonId,
      assignment_type: "automatic" as const,
      start_date: effectiveFrom,
      end_date: null,
    }));

  if (rows.length === 0) return { assigned: 0 };

  const { error } = await supabase.from("student_lesson_assignments").insert(rows);
  if (error) throw new Error(error.message);
  return { assigned: rows.length };
}

export async function refreshAutomaticLessonAssignmentsForStudent(
  studentId: string,
  academicYearId: string,
  placement: Placement,
  effectiveFrom: string
) {
  const supabase = await createClient();
  const closeDate = addDays(effectiveFrom, -1);

  const [{ data: currentAutos }, { data: lessons }] = await Promise.all([
    supabase
      .from("student_lesson_assignments")
      .select("id, lessons!inner(academic_year_id)")
      .eq("student_id", studentId)
      .eq("assignment_type", "automatic")
      .is("end_date", null)
      .eq("lessons.academic_year_id", academicYearId),
    supabase
      .from("lessons")
      .select(
        "id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology"
      )
      .eq("academic_year_id", academicYearId),
  ]);

  const closeIds = (currentAutos ?? []).map((r) => r.id);
  if (closeIds.length > 0) {
    const { error: closeError } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: closeDate })
      .in("id", closeIds);
    if (closeError) throw new Error(closeError.message);
  }

  const rows = (lessons ?? [])
    .filter((lesson) => studentMatchesLesson(placement, lesson))
    .map((lesson) => ({
      student_id: studentId,
      lesson_id: lesson.id,
      assignment_type: "automatic" as const,
      start_date: effectiveFrom,
      end_date: null,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("student_lesson_assignments").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { assigned: rows.length, closed: closeIds.length };
}
