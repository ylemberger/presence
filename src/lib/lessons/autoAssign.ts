import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso } from "@/lib/dates/hebrew";

type LessonScope = {
  id: string;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  billing_type: string;
  grade_id: string;
};

type Placement = {
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  grade_id: string;
};

export function studentMatchesLesson(placement: Placement, lesson: LessonScope): boolean {
  if (lesson.grade_id && lesson.grade_id !== placement.grade_id) {
    return false;
  }

  if (lesson.billing_type === "specialization") {
    return Boolean(
      lesson.specialization_id &&
        placement.specialization_id &&
        lesson.specialization_id === placement.specialization_id
    );
  }

  const classOk = !lesson.class_id || lesson.class_id === placement.class_id;
  const trackOk = !lesson.track_id || lesson.track_id === placement.track_id;
  return classOk && trackOk && Boolean(lesson.class_id || lesson.track_id);
}

export function lessonMismatchMessage(placement: Placement, lesson: LessonScope): string | null {
  if (studentMatchesLesson(placement, lesson)) return null;
  return "התלמידה לא אמורה להיות בשיעור הזה לפי השכבה/כיתה/מסלול/התמחות שלה.";
}

export async function autoAssignStudentsToLesson(
  lessonId: string,
  academicYearId: string,
  startDate?: string
) {
  const supabase = await createClient();
  const effectiveFrom = startDate || todayIso();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, class_id, track_id, specialization_id, billing_type, grade_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) return { assigned: 0 };

  const { data: placements } = await supabase
    .from("student_assignments")
    .select("student_id, class_id, track_id, specialization_id, grade_id")
    .eq("academic_year_id", academicYearId)
    .is("end_date", null);

  const matching = (placements ?? []).filter((p) =>
    studentMatchesLesson(
      {
        class_id: p.class_id,
        track_id: p.track_id,
        specialization_id: p.specialization_id,
        grade_id: p.grade_id,
      },
      lesson
    )
  );

  let assigned = 0;
  for (const p of matching) {
    const { data: existing } = await supabase
      .from("student_lesson_assignments")
      .select("id")
      .eq("student_id", p.student_id)
      .eq("lesson_id", lessonId)
      .is("end_date", null)
      .maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("student_lesson_assignments").insert({
      student_id: p.student_id,
      lesson_id: lessonId,
      assignment_type: "automatic",
      start_date: effectiveFrom,
      end_date: null,
    });
    if (!error) assigned++;
  }

  return { assigned };
}

export async function refreshAutomaticLessonAssignmentsForStudent(
  studentId: string,
  academicYearId: string,
  placement: Placement,
  effectiveFrom: string
) {
  const supabase = await createClient();
  const closeDate = addDays(effectiveFrom, -1);

  const { data: currentAutos } = await supabase
    .from("student_lesson_assignments")
    .select(
      "id, lesson_id, lessons!inner(id, academic_year_id, class_id, track_id, specialization_id, billing_type, grade_id)"
    )
    .eq("student_id", studentId)
    .eq("assignment_type", "automatic")
    .is("end_date", null)
    .eq("lessons.academic_year_id", academicYearId);

  for (const row of currentAutos ?? []) {
    await supabase
      .from("student_lesson_assignments")
      .update({ end_date: closeDate })
      .eq("id", row.id);
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, class_id, track_id, specialization_id, billing_type, grade_id")
    .eq("academic_year_id", academicYearId);

  let assigned = 0;
  for (const lesson of lessons ?? []) {
    if (!studentMatchesLesson(placement, lesson)) continue;
    const { error } = await supabase.from("student_lesson_assignments").insert({
      student_id: studentId,
      lesson_id: lesson.id,
      assignment_type: "automatic",
      start_date: effectiveFrom,
      end_date: null,
    });
    if (!error) assigned++;
  }

  return { assigned, closed: (currentAutos ?? []).length };
}
