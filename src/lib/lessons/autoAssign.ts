import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso } from "@/lib/dates/hebrew";

export type LessonAudienceIds = {
  grade_ids: string[];
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
};

export type LessonScope = {
  id: string;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  billing_type: string;
  grade_id: string;
  for_psychology?: boolean;
  audience?: LessonAudienceIds;
};

export type Placement = {
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id?: string | null;
  grade_id: string;
  is_psychology?: boolean;
};

function audienceOf(lesson: LessonScope): LessonAudienceIds {
  if (lesson.audience) {
    return {
      grade_ids: lesson.audience.grade_ids?.length
        ? lesson.audience.grade_ids
        : lesson.grade_id
          ? [lesson.grade_id]
          : [],
      class_ids: lesson.audience.class_ids ?? [],
      track_ids: lesson.audience.track_ids ?? [],
      specialization_ids: lesson.audience.specialization_ids ?? [],
    };
  }
  return {
    grade_ids: lesson.grade_id ? [lesson.grade_id] : [],
    class_ids: lesson.class_id ? [lesson.class_id] : [],
    track_ids: lesson.track_id ? [lesson.track_id] : [],
    specialization_ids: lesson.specialization_id ? [lesson.specialization_id] : [],
  };
}

/**
 * Match: student must be in one of the lesson grades.
 * Then AND across dimensions that have targets (class / track / specialization).
 * Within a dimension, any of the selected values matches (OR).
 */
export function studentMatchesLesson(placement: Placement, lesson: LessonScope): boolean {
  const audience = audienceOf(lesson);
  const gradeIds =
    audience.grade_ids.length > 0
      ? audience.grade_ids
      : lesson.grade_id
        ? [lesson.grade_id]
        : [];

  if (gradeIds.length > 0 && !gradeIds.includes(placement.grade_id)) {
    return false;
  }

  if (lesson.for_psychology) {
    return Boolean(placement.is_psychology);
  }

  const hasClass = audience.class_ids.length > 0;
  const hasTrack = audience.track_ids.length > 0;
  const hasSpec = audience.specialization_ids.length > 0;

  if (!hasClass && !hasTrack && !hasSpec) {
    return true;
  }

  if (hasClass && !audience.class_ids.includes(placement.class_id)) {
    return false;
  }
  if (hasTrack && !audience.track_ids.includes(placement.track_id)) {
    return false;
  }
  if (hasSpec) {
    const specOk =
      (placement.specialization_id &&
        audience.specialization_ids.includes(placement.specialization_id)) ||
      (placement.secondary_specialization_id &&
        audience.specialization_ids.includes(placement.secondary_specialization_id));
    if (!specOk) return false;
  }
  return true;
}

export function lessonMismatchMessage(placement: Placement, lesson: LessonScope): string | null {
  if (studentMatchesLesson(placement, lesson)) return null;
  if (lesson.for_psychology) {
    return "השיעור מיועד לפסיכולוגיה והתלמידה אינה מסומנת כפסיכולוגיה. אם תאשרי, השיעור ייספר כחיוב נוכחות שלה בדוחות.";
  }
  return "התלמידה לא שייכת לשכבה/כיתה/מסלול/התמחות של השיעור. אם תאשרי, השיעור ייספר כחיוב נוכחות שלה בדוחות.";
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

export type AudienceRow = {
  lesson_id: string;
  grade_id: string | null;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
};

export function audienceMapFromRows(rows: AudienceRow[]): Map<string, LessonAudienceIds> {
  const map = new Map<string, LessonAudienceIds>();
  for (const r of rows) {
    const cur = map.get(r.lesson_id) ?? {
      grade_ids: [],
      class_ids: [],
      track_ids: [],
      specialization_ids: [],
    };
    if (r.grade_id) cur.grade_ids.push(r.grade_id);
    if (r.class_id) cur.class_ids.push(r.class_id);
    if (r.track_id) cur.track_ids.push(r.track_id);
    if (r.specialization_id) cur.specialization_ids.push(r.specialization_id);
    map.set(r.lesson_id, cur);
  }
  return map;
}

export function audienceForLesson(
  lesson: {
    id: string;
    grade_id?: string | null;
    class_id: string | null;
    track_id: string | null;
    specialization_id: string | null;
  },
  map: Map<string, LessonAudienceIds>
): LessonAudienceIds {
  const fromMap = map.get(lesson.id);
  if (
    fromMap &&
    (fromMap.grade_ids.length > 0 ||
      fromMap.class_ids.length > 0 ||
      fromMap.track_ids.length > 0 ||
      fromMap.specialization_ids.length > 0)
  ) {
    return {
      grade_ids:
        fromMap.grade_ids.length > 0
          ? fromMap.grade_ids
          : lesson.grade_id
            ? [lesson.grade_id]
            : [],
      class_ids: fromMap.class_ids,
      track_ids: fromMap.track_ids,
      specialization_ids: fromMap.specialization_ids,
    };
  }
  return {
    grade_ids: lesson.grade_id ? [lesson.grade_id] : [],
    class_ids: lesson.class_id ? [lesson.class_id] : [],
    track_ids: lesson.track_id ? [lesson.track_id] : [],
    specialization_ids: lesson.specialization_id ? [lesson.specialization_id] : [],
  };
}

/** Filter: empty audience on a dimension means "no restriction" (whole grade / other groups). */
export function lessonMatchesAudienceFilter(
  audience: LessonAudienceIds,
  filter: { classId?: string; trackId?: string; specializationId?: string }
): boolean {
  if (filter.classId && audience.class_ids.length > 0 && !audience.class_ids.includes(filter.classId)) {
    return false;
  }
  if (filter.trackId && audience.track_ids.length > 0 && !audience.track_ids.includes(filter.trackId)) {
    return false;
  }
  if (
    filter.specializationId &&
    audience.specialization_ids.length > 0 &&
    !audience.specialization_ids.includes(filter.specializationId)
  ) {
    return false;
  }
  return true;
}

function withAudience(
  lesson: Omit<LessonScope, "audience"> & { id: string },
  rows: AudienceRow[]
): LessonScope {
  const mine = rows.filter((r) => r.lesson_id === lesson.id);
  const grade_ids = mine
    .map((r) => r.grade_id)
    .filter((id): id is string => Boolean(id));
  return {
    ...lesson,
    audience: {
      grade_ids: grade_ids.length > 0 ? grade_ids : lesson.grade_id ? [lesson.grade_id] : [],
      class_ids: mine.map((r) => r.class_id).filter((id): id is string => Boolean(id)),
      track_ids: mine.map((r) => r.track_id).filter((id): id is string => Boolean(id)),
      specialization_ids: mine
        .map((r) => r.specialization_id)
        .filter((id): id is string => Boolean(id)),
    },
  };
}

export async function autoAssignStudentsToLesson(
  lessonId: string,
  academicYearId: string,
  startDate?: string
) {
  const supabase = await createClient();

  const [{ data: lesson }, { data: placements }, { data: existingLinks }, { data: audience }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          "id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology, activity_ranges(start_date)"
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
        .select("id, student_id, start_date, assignment_type")
        .eq("lesson_id", lessonId)
        .is("end_date", null),
      supabase
        .from("lesson_audience")
        .select("lesson_id, grade_id, class_id, track_id, specialization_id")
        .eq("lesson_id", lessonId),
    ]);

  if (!lesson) return { assigned: 0 };

  const rawRange = lesson.activity_ranges as unknown;
  const range = (Array.isArray(rawRange) ? rawRange[0] : rawRange) as {
    start_date: string;
  } | null;
  const effectiveFrom = startDate || range?.start_date || todayIso();

  const scoped = withAudience(lesson, audience ?? []);

  const already = new Set((existingLinks ?? []).map((r) => r.student_id));
  const rows = (placements ?? [])
    .filter((p) => studentMatchesLesson(placementFromRow(p), scoped))
    .filter((p) => !already.has(p.student_id))
    .map((p) => ({
      student_id: p.student_id,
      lesson_id: lessonId,
      assignment_type: "automatic" as const,
      start_date: effectiveFrom,
      end_date: null,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("student_lesson_assignments").insert(rows);
    if (error) throw new Error(error.message);
  }

  const toBackfill = (existingLinks ?? []).filter(
    (r) => r.assignment_type === "automatic" && r.start_date > effectiveFrom
  );
  if (toBackfill.length > 0) {
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ start_date: effectiveFrom })
      .in(
        "id",
        toBackfill.map((r) => r.id)
      );
    if (error) throw new Error(error.message);
  }

  return { assigned: rows.length, backfilled: toBackfill.length };
}

export async function refreshAutomaticLessonAssignmentsForStudent(
  studentId: string,
  academicYearId: string,
  placement: Placement,
  effectiveFrom: string
) {
  const supabase = await createClient();
  const closeDate = addDays(effectiveFrom, -1);

  const [{ data: currentAutos }, { data: lessons }, { data: audience }] = await Promise.all([
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
    supabase
      .from("lesson_audience")
      .select("lesson_id, grade_id, class_id, track_id, specialization_id"),
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
    .map((lesson) => withAudience(lesson, audience ?? []))
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
