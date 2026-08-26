import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, startOfWeekSunday, todayIso } from "@/lib/dates/hebrew";

export type PendingOccurrence = {
  id: string;
  date: string;
  subject: string;
  lessonId: string;
  marked: number;
  total: number;
  gapHandling: "in_treatment" | "continued" | null;
};

export type IncompleteWeek = {
  weekStart: string;
  weekEnd: string;
  pendingCount: number;
};

export type PendingAttendanceSummary = {
  pendingCount: number;
  todayPending: number;
  pastPending: number;
  partialCount: number;
  unmarkedCount: number;
  incompleteWeeks: IncompleteWeek[];
  items: PendingOccurrence[];
};

export const EMPTY_PENDING_SUMMARY: PendingAttendanceSummary = {
  pendingCount: 0,
  todayPending: 0,
  pastPending: 0,
  partialCount: 0,
  unmarkedCount: 0,
  incompleteWeeks: [],
  items: [],
};

/**
 * Incomplete lesson occurrences from lookback days through today.
 * Used for gentle reminders (sidebar badge, banner). Cached per request.
 */
export const getPendingAttendanceSummary = cache(
  async (
    academicYearId: string,
    lookbackDays = 14
  ): Promise<PendingAttendanceSummary> => {
    const empty: PendingAttendanceSummary = {
      pendingCount: 0,
      todayPending: 0,
      pastPending: 0,
      partialCount: 0,
      unmarkedCount: 0,
      incompleteWeeks: [],
      items: [],
    };
    const supabase = await createClient();
    const today = todayIso();
    const from = addDays(today, -lookbackDays);

    const { data: occs } = await supabase
      .from("lesson_occurrences")
      .select(
        `id, occurrence_date, lesson_id, gap_handling,
         lessons!inner(id, subject, academic_year_id)`
      )
      .eq("lessons.academic_year_id", academicYearId)
      .gte("occurrence_date", from)
      .lte("occurrence_date", today)
      .neq("status", "cancelled")
      .order("occurrence_date", { ascending: false });

    if (!occs?.length) return empty;

    const lessonIds = [...new Set(occs.map((o) => o.lesson_id))];
    const occIds = occs.map((o) => o.id);

    const [{ data: links }, { data: attendance }] = await Promise.all([
      supabase
        .from("student_lesson_assignments")
        .select("lesson_id, student_id, start_date, end_date, students(is_active)")
        .in("lesson_id", lessonIds),
      supabase
        .from("attendance")
        .select("lesson_occurrence_id")
        .in("lesson_occurrence_id", occIds),
    ]);

    const markedByOcc = new Map<string, number>();
    for (const a of attendance ?? []) {
      markedByOcc.set(
        a.lesson_occurrence_id,
        (markedByOcc.get(a.lesson_occurrence_id) ?? 0) + 1
      );
    }

    const items: PendingOccurrence[] = [];
    for (const o of occs) {
      let total = 0;
      for (const link of links ?? []) {
        if (link.lesson_id !== o.lesson_id) continue;
        const active = (link.students as unknown as { is_active: boolean } | null)?.is_active;
        if (!active) continue;
        if (link.start_date > o.occurrence_date) continue;
        if (link.end_date && link.end_date < o.occurrence_date) continue;
        total++;
      }
      if (total === 0) continue;
      const marked = markedByOcc.get(o.id) ?? 0;
      if (marked >= total) continue;

      const lesson = o.lessons as unknown as { subject: string };
      const gap =
        o.gap_handling === "in_treatment" || o.gap_handling === "continued"
          ? o.gap_handling
          : null;
      items.push({
        id: o.id,
        date: o.occurrence_date,
        subject: lesson.subject,
        lessonId: o.lesson_id,
        marked,
        total,
        gapHandling: gap,
      });
    }

    const todayPending = items.filter((i) => i.date === today).length;
    const pastPending = items.filter((i) => i.date < today).length;
    const partialCount = items.filter((i) => i.marked > 0 && i.marked < i.total).length;
    const unmarkedCount = items.filter((i) => i.marked === 0).length;

    const weekMap = new Map<string, IncompleteWeek>();
    for (const item of items) {
      if (item.date >= today) continue;
      const weekStart = startOfWeekSunday(item.date);
      const weekEnd = addDays(weekStart, 6);
      const existing = weekMap.get(weekStart);
      if (existing) existing.pendingCount += 1;
      else weekMap.set(weekStart, { weekStart, weekEnd, pendingCount: 1 });
    }
    const incompleteWeeks = [...weekMap.values()].sort((a, b) =>
      b.weekStart.localeCompare(a.weekStart)
    );

    return {
      pendingCount: items.length,
      todayPending,
      pastPending,
      partialCount,
      unmarkedCount,
      incompleteWeeks,
      items: items.slice(0, 8),
    };
  }
);
