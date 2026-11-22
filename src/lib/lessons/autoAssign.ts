import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso, toIsoDay } from "@/lib/dates/hebrew";
import { fetchAllPages } from "@/lib/supabase/paged";
import { hebrewDbError } from "@/lib/db/hebrew-error";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function dbOf(db?: Supabase): Promise<Supabase> {
  return db ?? (await createClient());
}

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
 * Named-only lesson: no catalog audience (no grade / class / track / specialization).
 * Roster comes only from manual named assignments — never from auto-match.
 */
export function isNamedOnlyLesson(
  lesson: {
    grade_id?: string | null;
    class_id?: string | null;
    track_id?: string | null;
    specialization_id?: string | null;
    for_psychology?: boolean | null;
    audience?: LessonAudienceIds;
  },
  audienceRows?: AudienceRow[]
): boolean {
  if (lesson.for_psychology) return false;
  const audience = lesson.audience
    ? audienceOf(lesson as LessonScope)
    : audienceRows
      ? audienceForLesson(
          {
            id: "x",
            grade_id: lesson.grade_id,
            class_id: lesson.class_id ?? null,
            track_id: lesson.track_id ?? null,
            specialization_id: lesson.specialization_id ?? null,
          },
          audienceMapFromRows(audienceRows)
        )
      : audienceOf({
          id: "x",
          class_id: lesson.class_id ?? null,
          track_id: lesson.track_id ?? null,
          specialization_id: lesson.specialization_id ?? null,
          billing_type: "mandatory",
          grade_id: lesson.grade_id ?? "",
          for_psychology: false,
        });
  return (
    audience.grade_ids.length === 0 &&
    audience.class_ids.length === 0 &&
    audience.track_ids.length === 0 &&
    audience.specialization_ids.length === 0
  );
}

/**
 * Match: student must be in one of the lesson grades.
 * Then AND across dimensions that have targets (class / track / specialization).
 * Within a dimension, any of the selected values matches (OR).
 * Empty catalog audience (named-only) never auto-matches.
 */
export function studentMatchesLesson(placement: Placement, lesson: LessonScope): boolean {
  const audience = audienceOf(lesson);
  const gradeIds =
    audience.grade_ids.length > 0
      ? audience.grade_ids
      : lesson.grade_id
        ? [lesson.grade_id]
        : [];

  if (lesson.for_psychology) {
    if (gradeIds.length > 0 && !gradeIds.includes(placement.grade_id)) {
      return false;
    }
    return Boolean(placement.is_psychology);
  }

  const hasClass = audience.class_ids.length > 0;
  const hasTrack = audience.track_ids.length > 0;
  const hasSpec = audience.specialization_ids.length > 0;

  // Named-only / no catalog scope: never auto-assign (manual roster only).
  if (gradeIds.length === 0 && !hasClass && !hasTrack && !hasSpec) {
    return false;
  }

  if (gradeIds.length > 0 && !gradeIds.includes(placement.grade_id)) {
    return false;
  }

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
  is_psychology?: boolean | null;
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
  const grade_ids =
    fromMap && fromMap.grade_ids.length > 0
      ? fromMap.grade_ids
      : lesson.grade_id
        ? [lesson.grade_id]
        : [];
  // Prefer multi-target rows from lesson_audience; fall back to legacy columns on lessons
  // when a dimension was never written to the audience table (common once grade rows exist).
  const class_ids =
    fromMap && fromMap.class_ids.length > 0
      ? fromMap.class_ids
      : lesson.class_id
        ? [lesson.class_id]
        : [];
  const track_ids =
    fromMap && fromMap.track_ids.length > 0
      ? fromMap.track_ids
      : lesson.track_id
        ? [lesson.track_id]
        : [];
  const specialization_ids =
    fromMap && fromMap.specialization_ids.length > 0
      ? fromMap.specialization_ids
      : lesson.specialization_id
        ? [lesson.specialization_id]
        : [];
  return { grade_ids, class_ids, track_ids, specialization_ids };
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
  const fromRows: LessonAudienceIds = {
    grade_ids: mine.map((r) => r.grade_id).filter((id): id is string => Boolean(id)),
    class_ids: mine.map((r) => r.class_id).filter((id): id is string => Boolean(id)),
    track_ids: mine.map((r) => r.track_id).filter((id): id is string => Boolean(id)),
    specialization_ids: mine
      .map((r) => r.specialization_id)
      .filter((id): id is string => Boolean(id)),
  };
  return {
    ...lesson,
    audience: audienceForLesson(lesson, new Map([[lesson.id, fromRows]])),
  };
}

function isMissingExclusionTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /student_lesson_exclusions|schema cache|PGRST205|42P01/i.test(msg);
}

async function excludedStudentIdsForLesson(
  supabase: Supabase,
  lessonId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("student_lesson_exclusions")
    .select("student_id")
    .eq("lesson_id", lessonId);
  if (error) {
    if (isMissingExclusionTable(error)) return new Set();
    throw error;
  }
  return new Set((data ?? []).map((row) => row.student_id));
}

async function excludedLessonIdsForStudent(
  supabase: Supabase,
  studentId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("student_lesson_exclusions")
    .select("lesson_id")
    .eq("student_id", studentId);
  if (error) {
    if (isMissingExclusionTable(error)) return new Set();
    throw error;
  }
  return new Set((data ?? []).map((row) => row.lesson_id));
}

/** Close open automatic links (named-only lessons / leftover whole-grade sync). */
export async function closeOpenAutomaticAssignmentsForLesson(
  lessonId: string,
  db?: Supabase
): Promise<{ closed: number }> {
  const supabase = await dbOf(db);
  const openAutomatic = await fetchAllPages<{
    id: string;
    start_date: string;
  }>((from, to) =>
    supabase
      .from("student_lesson_assignments")
      .select("id, start_date")
      .eq("lesson_id", lessonId)
      .eq("assignment_type", "automatic")
      .is("end_date", null)
      .range(from, to)
  );
  if (openAutomatic.length === 0) return { closed: 0 };

  const today = todayIso();
  const yesterday = addDays(today, -1);
  let closed = 0;
  for (const row of openAutomatic) {
    const start = row.start_date.slice(0, 10);
    if (start >= today) {
      const { error } = await supabase
        .from("student_lesson_assignments")
        .delete()
        .eq("id", row.id);
      if (error) throw new Error(hebrewDbError(error, "סגירת שיוך אוטומטי נכשלה"));
      closed += 1;
      continue;
    }
    const endDate = start > yesterday ? start : yesterday;
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: endDate })
      .eq("id", row.id);
    if (error) throw new Error(hebrewDbError(error, "סגירת שיוך אוטומטי נכשלה"));
    closed += 1;
  }
  return { closed };
}

export async function autoAssignStudentsToLesson(
  lessonId: string,
  academicYearId: string,
  startDate?: string,
  db?: Supabase
) {
  const supabase = await dbOf(db);
  const excludedStudents = await excludedStudentIdsForLesson(supabase, lessonId);

  const [{ data: lesson }, placements, existingLinks, { data: audience }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology, activity_ranges(start_date)"
      )
      .eq("id", lessonId)
      .single(),
    fetchAllPages<{
      student_id: string;
      class_id: string;
      track_id: string;
      specialization_id: string;
      secondary_specialization_id: string | null;
      grade_id: string;
      is_psychology: boolean | null;
    }>((from, to) =>
      supabase
        .from("student_assignments")
        .select(
          "student_id, class_id, track_id, specialization_id, secondary_specialization_id, grade_id, is_psychology"
        )
        .eq("academic_year_id", academicYearId)
        .is("end_date", null)
        .range(from, to)
    ),
    fetchAllPages<{
      id: string;
      student_id: string;
      start_date: string;
      assignment_type: string;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("id, student_id, start_date, assignment_type")
        .eq("lesson_id", lessonId)
        .is("end_date", null)
        .range(from, to)
    ),
    supabase
      .from("lesson_audience")
      .select("lesson_id, grade_id, class_id, track_id, specialization_id")
      .eq("lesson_id", lessonId),
  ]);

  if (!lesson) return { assigned: 0, backfilled: 0 };

  const scoped = withAudience(
    { ...lesson, for_psychology: Boolean(lesson.for_psychology) },
    audience ?? []
  );
  // Named-only: never auto-assign; drop leftover automatic links from an earlier whole-grade sync.
  if (isNamedOnlyLesson(scoped, audience ?? [])) {
    const closed = await closeOpenAutomaticAssignmentsForLesson(lessonId, supabase);
    return { assigned: 0, backfilled: 0, closed: closed.closed };
  }

  const rawRange = lesson.activity_ranges as unknown;
  const range = (Array.isArray(rawRange) ? rawRange[0] : rawRange) as {
    start_date: string;
  } | null;
  const effectiveFrom =
    toIsoDay(startDate || range?.start_date) || todayIso();

  const already = new Set(existingLinks.map((r) => r.student_id));
  const rows = placements
    .filter((p) => studentMatchesLesson(placementFromRow(p), scoped))
    .filter((p) => !already.has(p.student_id))
    .filter((p) => !excludedStudents.has(p.student_id))
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

  const toBackfill = existingLinks.filter(
    (r) => r.assignment_type === "automatic" && toIsoDay(r.start_date) > effectiveFrom
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

/** Close automatic links that no longer match the lesson audience, then add missing ones. */
export async function refreshAutomaticAssignmentsForLesson(
  lessonId: string,
  academicYearId: string,
  db?: Supabase
) {
  const supabase = await dbOf(db);
  const result = await autoAssignStudentsToLesson(lessonId, academicYearId, undefined, supabase);
  if ("closed" in result && typeof result.closed === "number" && result.closed > 0) {
    // Named-only path already closed leftover automatic links.
    return { assigned: result.assigned, backfilled: result.backfilled, closed: result.closed };
  }

  const [{ data: lesson }, placements, existingLinks, { data: audience }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology")
      .eq("id", lessonId)
      .maybeSingle(),
    fetchAllPages<{
      student_id: string;
      class_id: string;
      track_id: string;
      specialization_id: string;
      secondary_specialization_id: string | null;
      grade_id: string;
      is_psychology: boolean | null;
    }>((from, to) =>
      supabase
        .from("student_assignments")
        .select(
          "student_id, class_id, track_id, specialization_id, secondary_specialization_id, grade_id, is_psychology"
        )
        .eq("academic_year_id", academicYearId)
        .is("end_date", null)
        .range(from, to)
    ),
    fetchAllPages<{
      id: string;
      student_id: string;
      start_date: string;
      assignment_type: string;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("id, student_id, start_date, assignment_type")
        .eq("lesson_id", lessonId)
        .eq("assignment_type", "automatic")
        .is("end_date", null)
        .range(from, to)
    ),
    supabase
      .from("lesson_audience")
      .select("lesson_id, grade_id, class_id, track_id, specialization_id")
      .eq("lesson_id", lessonId),
  ]);

  if (!lesson) return { ...result, closed: 0 };

  const scoped = withAudience(
    { ...lesson, for_psychology: Boolean(lesson.for_psychology) },
    audience ?? []
  );
  const matching = new Set(
    placements
      .filter((p) => studentMatchesLesson(placementFromRow(p), scoped))
      .map((p) => p.student_id)
  );

  const toClose = existingLinks.filter((row) => !matching.has(row.student_id));
  if (toClose.length === 0) return { ...result, closed: 0 };

  // End yesterday so today is already off the roster; delete rows that never covered a past day.
  const today = todayIso();
  const yesterday = addDays(today, -1);
  for (const row of toClose) {
    const start = row.start_date.slice(0, 10);
    if (start >= today) {
      const { error } = await supabase
        .from("student_lesson_assignments")
        .delete()
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      continue;
    }
    const endDate = start > yesterday ? start : yesterday;
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: endDate })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  return { ...result, closed: toClose.length };
}

async function loadAllRows<T>(
  load: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(hebrewDbError(error, "עדכון שיעורי התלמידה נכשל"));
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

export async function refreshAutomaticLessonAssignmentsForStudent(
  studentId: string,
  academicYearId: string,
  placement: Placement,
  effectiveFrom: string,
  db?: Supabase,
  options?: { clearExclusionsForMatches?: boolean }
) {
  const supabase = await dbOf(db);
  const closeDate = addDays(effectiveFrom, -1);
  let excludedLessons = await excludedLessonIdsForStudent(supabase, studentId);

  const [openLinks, lessons, audience] = await Promise.all([
    loadAllRows<{
      id: string;
      lesson_id: string;
      start_date: string;
      assignment_type: string;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("id, lesson_id, start_date, assignment_type, lessons!inner(academic_year_id)")
        .eq("student_id", studentId)
        .is("end_date", null)
        .eq("lessons.academic_year_id", academicYearId)
        .range(from, to)
    ),
    loadAllRows<{
      id: string;
      class_id: string | null;
      track_id: string | null;
      specialization_id: string | null;
      billing_type: string;
      grade_id: string;
      for_psychology: boolean | null;
    }>((from, to) =>
      supabase
        .from("lessons")
        .select("id, class_id, track_id, specialization_id, billing_type, grade_id, for_psychology")
        .eq("academic_year_id", academicYearId)
        .range(from, to)
    ),
    loadAllRows<AudienceRow>((from, to) =>
      supabase
        .from("lesson_audience")
        .select("lesson_id, grade_id, class_id, track_id, specialization_id")
        .range(from, to)
    ),
  ]);

  const matchIds = lessons
    .map((lesson) =>
      withAudience({ ...lesson, for_psychology: Boolean(lesson.for_psychology) }, audience)
    )
    .filter((lesson) => studentMatchesLesson(placement, lesson))
    .map((lesson) => lesson.id);

  // On transfer: drop exclusions for lessons that now match so specialization
  // lessons open automatically (manual «הסר שיוך» still blocks until transfer).
  if (options?.clearExclusionsForMatches && excludedLessons.size > 0 && matchIds.length > 0) {
    const toClear = matchIds.filter((id) => excludedLessons.has(id));
    if (toClear.length > 0) {
      const { error: clearError } = await supabase
        .from("student_lesson_exclusions")
        .delete()
        .eq("student_id", studentId)
        .in("lesson_id", toClear);
      if (clearError && !isMissingExclusionTable(clearError)) {
        throw new Error(hebrewDbError(clearError, "הסרת החרגות לשיעורים החדשים נכשלה"));
      }
      excludedLessons = new Set(
        [...excludedLessons].filter((id) => !toClear.includes(id))
      );
    }
  }

  const matching = new Set(
    matchIds.filter((id) => !excludedLessons.has(id))
  );

  const toClose = openLinks.filter(
    (row) => row.assignment_type === "automatic" && !matching.has(row.lesson_id)
  );
  for (const row of toClose) {
    const start = String(row.start_date).slice(0, 10);
    const endDate = start > closeDate ? start : closeDate;
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: endDate })
      .eq("id", row.id)
      .is("end_date", null);
    if (error) throw new Error(hebrewDbError(error, "סגירת שיוך השיעור הקודם נכשלה"));
  }

  const closedIds = new Set(toClose.map((row) => row.id));
  const closedLessonIds = [...new Set(toClose.map((row) => row.lesson_id))];
  const stillOpen = new Set(
    openLinks.filter((row) => !closedIds.has(row.id)).map((row) => row.lesson_id)
  );

  for (const row of openLinks) {
    if (closedIds.has(row.id) || row.assignment_type !== "automatic") continue;
    if (!matching.has(row.lesson_id)) continue;
    const start = String(row.start_date).slice(0, 10);
    if (start <= effectiveFrom) continue;
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ start_date: effectiveFrom })
      .eq("id", row.id);
    if (error) throw new Error(hebrewDbError(error, "עדכון תאריך השיוך לשיעור נכשל"));
  }

  const needAssign = [...matching].filter((lessonId) => !stillOpen.has(lessonId));
  let assigned = 0;

  if (needAssign.length > 0) {
    // Re-open closed automatic rows that would overlap the new window (common after
    // transfer / retroactive date fix), instead of inserting a second overlapping row.
    const closedForLessons = await loadAllRows<{
      id: string;
      lesson_id: string;
      start_date: string;
      end_date: string | null;
      assignment_type: string;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("id, lesson_id, start_date, end_date, assignment_type")
        .eq("student_id", studentId)
        .in("lesson_id", needAssign)
        .not("end_date", "is", null)
        .gte("end_date", effectiveFrom)
        .range(from, to)
    );

    const reopenByLesson = new Map<string, (typeof closedForLessons)[number]>();
    for (const row of closedForLessons) {
      if (row.assignment_type !== "automatic") continue;
      const prev = reopenByLesson.get(row.lesson_id);
      if (!prev || String(row.end_date) > String(prev.end_date)) {
        reopenByLesson.set(row.lesson_id, row);
      }
    }

    const reopenedIds = new Set<string>();
    for (const [lessonId, row] of reopenByLesson) {
      const start = String(row.start_date).slice(0, 10);
      const nextStart = start < effectiveFrom ? start : effectiveFrom;
      const { error } = await supabase
        .from("student_lesson_assignments")
        .update({ end_date: null, start_date: nextStart, assignment_type: "automatic" })
        .eq("id", row.id);
      if (error) throw new Error(hebrewDbError(error, "פתיחה מחדש של שיוך השיעור נכשלה"));
      assigned += 1;
      stillOpen.add(lessonId);
      reopenedIds.add(row.id);
    }

    // Shorten other closed rows that would still overlap the new open window.
    for (const row of closedForLessons) {
      if (reopenedIds.has(row.id)) continue;
      if (!needAssign.includes(row.lesson_id)) continue;
      const start = String(row.start_date).slice(0, 10);
      if (start > closeDate) {
        const { error } = await supabase
          .from("student_lesson_assignments")
          .delete()
          .eq("id", row.id);
        if (error) {
          throw new Error(hebrewDbError(error, "ניקוי שיוך שיעור חופף נכשל"));
        }
        continue;
      }
      const { error } = await supabase
        .from("student_lesson_assignments")
        .update({ end_date: closeDate })
        .eq("id", row.id);
      if (error) {
        throw new Error(hebrewDbError(error, "קיצור שיוך שיעור קודם נכשל"));
      }
    }

    const rows = needAssign
      .filter((lessonId) => !stillOpen.has(lessonId))
      .map((lessonId) => ({
        student_id: studentId,
        lesson_id: lessonId,
        assignment_type: "automatic" as const,
        start_date: effectiveFrom,
        end_date: null,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("student_lesson_assignments").insert(rows);
      if (error) throw new Error(hebrewDbError(error, "שיוך השיעורים החדשים נכשל"));
      assigned += rows.length;
    }
  }

  return {
    assigned,
    closed: toClose.length,
    closedLessonIds,
  };
}
