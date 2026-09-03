import { addDays, startOfWeekSunday } from "@/lib/dates/hebrew";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type IncompletePreviousOccurrence = {
  id: string;
  date: string;
};

function previousWeekRange(occurrenceDate: string): { start: string; end: string } {
  const weekStart = startOfWeekSunday(occurrenceDate);
  const start = addDays(weekStart, -7);
  const end = addDays(weekStart, -1);
  return { start, end };
}

/**
 * חוסם סימון למופע אם לשיעור יש מופע בשבוע הקודם (א'-ש') שלא מולא במלואו.
 * לא מוחק ולא משנה שורות קיימות.
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
    .select("id, occurrence_date, lesson_id")
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
      const active = (link.students as unknown as { is_active: boolean } | null)?.is_active;
      if (!active) return false;
      if (link.start_date > occ.occurrence_date) return false;
      if (link.end_date && link.end_date < occ.occurrence_date) return false;
      return true;
    });
    if (students.length === 0) continue;
    const allMarked = students.every((s) => markedSet.has(`${occ.id}::${s.student_id}`));
    if (!allMarked) {
      incomplete.push({ id: occ.id, date: occ.occurrence_date });
    }
  }

  return incomplete.sort((a, b) => a.date.localeCompare(b.date));
}

export async function previousWeekBlockMessage(
  supabase: Supabase,
  occurrenceIds: string[]
): Promise<string | null> {
  const unique = [...new Set(occurrenceIds.filter(Boolean))];
  for (const id of unique) {
    const incomplete = await findIncompletePreviousWeekOccurrences(supabase, id);
    if (incomplete.length > 0) {
      return "יש להשלים קודם את נוכחות השבוע הקודם של השיעור הזה.";
    }
  }
  return null;
}
