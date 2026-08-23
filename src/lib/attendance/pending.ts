import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso } from "@/lib/dates/hebrew";

export type PendingOccurrence = {
  id: string;
  date: string;
  subject: string;
  marked: number;
  total: number;
};

export type PendingAttendanceSummary = {
  pendingCount: number;
  todayPending: number;
  pastPending: number;
  items: PendingOccurrence[];
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
    const supabase = await createClient();
    const today = todayIso();
    const from = addDays(today, -lookbackDays);

    const { data: occs } = await supabase
      .from("lesson_occurrences")
      .select(
        `id, occurrence_date, lesson_id,
         lessons!inner(id, subject, academic_year_id)`
      )
      .eq("lessons.academic_year_id", academicYearId)
      .gte("occurrence_date", from)
      .lte("occurrence_date", today)
      .neq("status", "cancelled")
      .order("occurrence_date", { ascending: false });

    if (!occs?.length) {
      return { pendingCount: 0, todayPending: 0, pastPending: 0, items: [] };
    }

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
      items.push({
        id: o.id,
        date: o.occurrence_date,
        subject: lesson.subject,
        marked,
        total,
      });
    }

    const todayPending = items.filter((i) => i.date === today).length;
    const pastPending = items.filter((i) => i.date < today).length;

    return {
      pendingCount: items.length,
      todayPending,
      pastPending,
      items: items.slice(0, 8),
    };
  }
);
