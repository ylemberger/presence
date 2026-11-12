import { addDays, isDateInRange, startOfWeekSunday } from "@/lib/dates/hebrew";
import { embedOne } from "@/lib/supabase/embed";
import { fetchAllPages, fetchAssignmentsByLessons } from "@/lib/supabase/paged";
import { readShellCache, writeShellCache } from "@/lib/attendance/shell-cache";
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
 * לתזכורת במסך בלבד — שמירת נוכחות במופע הנוכחי לא נחסמת.
 * `continued` = המשתמשת בחרה להמשיך ולחזור מאוחר יותר.
 */
export async function findIncompletePreviousWeekOccurrences(
  supabase: Supabase,
  occurrenceId: string
): Promise<IncompletePreviousOccurrence[]> {
  const cacheKey = `prev-week:${occurrenceId}`;
  const cached = readShellCache<IncompletePreviousOccurrence[]>(cacheKey, 20_000);
  if (cached) return cached;

  const { data: current, error } = await supabase
    .from("lesson_occurrences")
    .select("id, lesson_id, occurrence_date, lesson_number")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error || !current) return writeShellCache(cacheKey, []);

  const { start, end } = previousWeekRange(current.occurrence_date);
  let prevQuery = supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, lesson_id, gap_handling")
    .eq("lesson_id", current.lesson_id)
    .gte("occurrence_date", start)
    .lte("occurrence_date", end)
    .neq("status", "cancelled");
  if (current.lesson_number != null) {
    prevQuery = prevQuery.eq("lesson_number", current.lesson_number);
  }
  const { data: prevOccs } = await prevQuery;

  if (!prevOccs?.length) return writeShellCache(cacheKey, []);

  const lessonId = current.lesson_id;
  const occIds = prevOccs.map((o) => o.id);

  const [links, marked] = await Promise.all([
    fetchAssignmentsByLessons<{
      student_id: string;
      start_date: string;
      end_date: string | null;
      students: unknown;
    }>(
      supabase,
      [lessonId],
      "student_id, start_date, end_date, students(is_active)"
    ),
    fetchAllPages<{ student_id: string; lesson_occurrence_id: string }>((from, to) =>
      supabase
        .from("attendance")
        .select("student_id, lesson_occurrence_id")
        .in("lesson_occurrence_id", occIds)
        .range(from, to)
    ),
  ]);

  const markedSet = new Set(
    (marked ?? []).map((a) => `${a.lesson_occurrence_id}::${a.student_id}`)
  );

  const incomplete: IncompletePreviousOccurrence[] = [];
  for (const occ of prevOccs) {
    const students = links.filter((link) => {
      const active = embedOne<{ is_active?: boolean }>(link.students);
      if (active?.is_active === false) return false;
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

  return writeShellCache(
    cacheKey,
    incomplete.sort((a, b) => a.date.localeCompare(b.date))
  );
}

/** Incomplete previous-week rows still shown as a soft reminder (not marked "continued"). */
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

/** @deprecated Soft reminder only — never used to block saves. Always returns null. */
export async function previousWeekBlockMessage(
  _supabase: Supabase,
  _occurrenceIds: string[]
): Promise<string | null> {
  return null;
}

/** @deprecated Soft reminder only — never used to block saves. Always returns null. */
export async function previousWeekStartBlockMessage(
  _supabase: Supabase,
  _occurrenceIds: string[]
): Promise<string | null> {
  return null;
}
