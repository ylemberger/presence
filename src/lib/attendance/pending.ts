import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, isDateInRange, startOfWeekSunday, todayIso } from "@/lib/dates/hebrew";
import { embedOne } from "@/lib/supabase/embed";
import { fetchAllPages, fetchAssignmentsByLessons } from "@/lib/supabase/paged";
import { fetchAttendanceForOccurrences } from "@/lib/attendance/load-occurrences";
import { readShellCache, writeShellCache } from "@/lib/attendance/shell-cache";

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

const PENDING_TTL_MS = 20_000;

type PendingOccRow = {
  id: string;
  occurrence_date: string;
  lesson_id: string;
  gap_handling: string | null;
  lessons: unknown;
};

/**
 * Incomplete lesson occurrences from lookback days through today.
 * Used for gentle reminders (sidebar badge, banner). Cached per request
 * and briefly across requests; attendance writes bust that cache.
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
    const cacheKey = `pending:${academicYearId}:${lookbackDays}`;
    const cached = readShellCache<PendingAttendanceSummary>(cacheKey, PENDING_TTL_MS);
    if (cached) return cached;

    const supabase = await createClient();
    const today = todayIso();
    const from = addDays(today, -lookbackDays);

    const occs = await fetchAllPages<PendingOccRow>((fromRow, toRow) =>
      supabase
        .from("lesson_occurrences")
        .select(
          `id, occurrence_date, lesson_id, gap_handling,
           lessons!inner(id, subject, academic_year_id)`
        )
        .eq("lessons.academic_year_id", academicYearId)
        .gte("occurrence_date", from)
        .lte("occurrence_date", today)
        .neq("status", "cancelled")
        .order("occurrence_date", { ascending: false })
        .range(fromRow, toRow) as PromiseLike<{
        data: PendingOccRow[] | null;
        error: { message: string } | null;
      }>
    );

    if (!occs.length) return writeShellCache(cacheKey, empty);

    const lessonIds = [...new Set(occs.map((o) => o.lesson_id))];
    const occIds = occs.map((o) => o.id);

    const [links, attendance] = await Promise.all([
      fetchAssignmentsByLessons<{
        lesson_id: string;
        student_id: string;
        start_date: string;
        end_date: string | null;
        students: unknown;
      }>(
        supabase,
        lessonIds,
        "lesson_id, student_id, start_date, end_date, students(is_active)"
      ),
      fetchAttendanceForOccurrences<{ lesson_occurrence_id: string }>(
        supabase,
        occIds,
        "lesson_occurrence_id"
      ),
    ]);

    const markedByOcc = new Map<string, number>();
    for (const a of attendance) {
      markedByOcc.set(
        a.lesson_occurrence_id,
        (markedByOcc.get(a.lesson_occurrence_id) ?? 0) + 1
      );
    }

    const linksByLesson = new Map<string, typeof links>();
    for (const link of links) {
      const list = linksByLesson.get(link.lesson_id);
      if (list) list.push(link);
      else linksByLesson.set(link.lesson_id, [link]);
    }

    const items: PendingOccurrence[] = [];
    for (const o of occs) {
      let total = 0;
      for (const link of linksByLesson.get(o.lesson_id) ?? []) {
        const active = embedOne<{ is_active?: boolean }>(link.students);
        if (active?.is_active === false) continue;
        if (!isDateInRange(o.occurrence_date, link.start_date, link.end_date)) continue;
        total++;
      }
      if (total === 0) continue;
      const marked = markedByOcc.get(o.id) ?? 0;
      if (marked >= total) continue;

      const lesson = embedOne<{ subject?: string }>(o.lessons);
      const gap =
        o.gap_handling === "in_treatment" || o.gap_handling === "continued"
          ? o.gap_handling
          : null;
      items.push({
        id: o.id,
        date: o.occurrence_date,
        subject: lesson?.subject?.trim() || "שיעור",
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

    const summary: PendingAttendanceSummary = {
      pendingCount: items.length,
      todayPending,
      pastPending,
      partialCount,
      unmarkedCount,
      incompleteWeeks,
      items: items.slice(0, 8),
    };
    return writeShellCache(cacheKey, summary);
  }
);
