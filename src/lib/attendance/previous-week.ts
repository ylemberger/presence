import { addDays, isDateInRange, startOfWeekSunday } from "@/lib/dates/hebrew";
import { embedOne } from "@/lib/supabase/embed";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type IncompletePreviousOccurrence = {
  id: string;
  date: string;
  gapHandling: "in_treatment" | "continued" | null;
};

function previousWeekRange(occurrenceDate: string): { start: string; end: string } {
  const weekStart = startOfWeekSunday(occurrenceDate);
  const start = addDays(weekStart, -7);
  const end = addDays(weekStart, -1);
  return { start, end };
}

function parseGapHandling(
  value: string | null | undefined
): IncompletePreviousOccurrence["gapHandling"] {
  return value === "in_treatment" || value === "continued" ? value : null;
}

/**
 * מופעים חסרים של אותו שיעור בשבוע הקודם (א'-ש').
 * `continued` לא נספר כחוסם סימון — רק כתזכורת רכה אם בכלל.
 */
export async function findIncompletePreviousWeekOccurrences(
  supabase: Supabase,
  occurrenceId: string
): Promise<IncompletePreviousOccurrence[]> {
  const { data: current, error } = await supabase
    .from("lesson_occurrences")
    .select("id, lesson_id, occurrence_date")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error || !current) return [];

  const { start, end } = previousWeekRange(current.occurrence_date);
  const { data: prevOccs } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, lesson_id, gap_handling")
    .eq("lesson_id", current.lesson_id)
    .gte("occurrence_date", start)
    .lte("occurrence_date", end)
    .neq("status", "cancelled");

  if (!prevOccs?.length) return [];

  const lessonId = current.lesson_id;
  const occIds = prevOccs.map((o) => o.id);

  const [{ data: links }, { data: marked }] = await Promise.all([
    supabase
      .from("student_lesson_assignments")
      .select("student_id, start_date, end_date, students(is_active)")
      .eq("lesson_id", lessonId),
    supabase
      .from("attendance")
      .select("student_id, lesson_occurrence_id")
      .in("lesson_occurrence_id", occIds),
  ]);

  const markedSet = new Set(
    (marked ?? []).map((a) => `${a.lesson_occurrence_id}::${a.student_id}`)
  );

  const incomplete: IncompletePreviousOccurrence[] = [];
  for (const occ of prevOccs) {
    const students = (links ?? []).filter((link) => {
      const active = embedOne<{ is_active: boolean }>(link.students)?.is_active;
      if (!active) return false;
      return isDateInRange(occ.occurrence_date, link.start_date, link.end_date);
    });
    if (students.length === 0) continue;
    const allMarked = students.every((s) => markedSet.has(`${occ.id}::${s.student_id}`));
    if (!allMarked) {
      incomplete.push({
        id: occ.id,
        date: occ.occurrence_date,
        gapHandling: parseGapHandling(occ.gap_handling),
      });
    }
  }

  return incomplete.sort((a, b) => a.date.localeCompare(b.date));
}

/** Incomplete previous-week rows that still block marking (not marked "continued"). */
export function blockingPreviousWeekGaps(
  incomplete: IncompletePreviousOccurrence[]
): IncompletePreviousOccurrence[] {
  return incomplete.filter((o) => o.gapHandling !== "continued");
}

export async function occurrenceHasAttendance(
  supabase: Supabase,
  occurrenceId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("lesson_occurrence_id", occurrenceId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function previousWeekBlockMessage(
  supabase: Supabase,
  occurrenceIds: string[]
): Promise<string | null> {
  const unique = [...new Set(occurrenceIds.filter(Boolean))];
  for (const id of unique) {
    const incomplete = await findIncompletePreviousWeekOccurrences(supabase, id);
    if (blockingPreviousWeekGaps(incomplete).length > 0) {
      return "יש להשלים קודם את נוכחות השבוע הקודם של השיעור הזה.";
    }
  }
  return null;
}

/** Block only starting a new occurrence — not correcting marks that already exist. */
export async function previousWeekStartBlockMessage(
  supabase: Supabase,
  occurrenceIds: string[]
): Promise<string | null> {
  const unique = [...new Set(occurrenceIds.filter(Boolean))];
  const unstarted: string[] = [];
  for (const id of unique) {
    if (!(await occurrenceHasAttendance(supabase, id))) unstarted.push(id);
  }
  if (unstarted.length === 0) return null;
  return previousWeekBlockMessage(supabase, unstarted);
}
