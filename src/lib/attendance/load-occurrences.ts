import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds, fetchAllPages } from "@/lib/supabase/paged";
import { isMissingOccurrenceHourColumn } from "@/lib/lessons/occurrences";

export type SkinnyOccurrence = {
  id: string;
  occurrence_date: string;
  status: string;
  lesson_id: string;
  lesson_number: number | null;
};

function occurrenceQuery(
  supabase: SupabaseClient,
  opts: {
    lessonIds: string[];
    lessonId?: string;
    fromDate?: string;
    toDate?: string;
    includeCancelled: boolean;
    withHour: boolean;
    from: number;
    to: number;
  }
) {
  const columns = opts.withHour
    ? "id, occurrence_date, status, lesson_number, lesson_id"
    : "id, occurrence_date, status, lesson_id";
  let query = supabase.from("lesson_occurrences").select(columns).order("occurrence_date");
  if (opts.lessonId) query = query.eq("lesson_id", opts.lessonId);
  else if (opts.lessonIds.length > 0) query = query.in("lesson_id", opts.lessonIds);
  if (opts.fromDate) query = query.gte("occurrence_date", opts.fromDate);
  if (opts.toDate) query = query.lte("occurrence_date", opts.toDate);
  if (!opts.includeCancelled) query = query.neq("status", "cancelled");
  return query.range(opts.from, opts.to);
}

function asSkinny(
  rows: Array<{
    id: string;
    occurrence_date: string;
    status: string;
    lesson_id: string;
    lesson_number?: number | null;
  }>
): SkinnyOccurrence[] {
  return rows.map((row) => ({
    id: row.id,
    occurrence_date: row.occurrence_date,
    status: row.status,
    lesson_id: row.lesson_id,
    lesson_number: row.lesson_number ?? null,
  }));
}

/** All matching occurrences, past the 1000-row cap. Skinny rows — lesson metadata comes from the shell. */
export async function fetchSkinnyOccurrences(
  supabase: SupabaseClient,
  opts: {
    yearLessonIds: string[];
    lessonId?: string;
    fromDate?: string;
    toDate?: string;
    includeCancelled?: boolean;
  }
): Promise<SkinnyOccurrence[]> {
  const includeCancelled = Boolean(opts.includeCancelled);
  const lessonId = opts.lessonId;
  const lessonChunks = lessonId ? [[lessonId]] : chunkIds(opts.yearLessonIds);
  if (lessonChunks.length === 0) return [];

  const probe = await occurrenceQuery(supabase, {
    lessonIds: lessonChunks[0],
    lessonId,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    includeCancelled,
    withHour: true,
    from: 0,
    to: 0,
  });
  const withHour = !(probe.error && isMissingOccurrenceHourColumn(probe.error));

  const pages = await Promise.all(
    lessonChunks.map((chunk) =>
      fetchAllPages<{
        id: string;
        occurrence_date: string;
        status: string;
        lesson_id: string;
        lesson_number?: number | null;
      }>((from, to) =>
        occurrenceQuery(supabase, {
          lessonIds: chunk,
          lessonId,
          fromDate: opts.fromDate,
          toDate: opts.toDate,
          includeCancelled,
          withHour,
          from,
          to,
        }) as PromiseLike<{
          data: Array<{
            id: string;
            occurrence_date: string;
            status: string;
            lesson_id: string;
            lesson_number?: number | null;
          }> | null;
          error: { message: string } | null;
        }>
      )
    )
  );
  return asSkinny(pages.flat());
}

export async function fetchAttendanceForOccurrences<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  occurrenceIds: string[],
  columns: string
): Promise<T[]> {
  if (occurrenceIds.length === 0) return [];
  const pages = await Promise.all(
    chunkIds(occurrenceIds).map((chunk) =>
      fetchAllPages<T>((from, to) =>
        supabase
          .from("attendance")
          .select(columns)
          .in("lesson_occurrence_id", chunk)
          .range(from, to) as PromiseLike<{ data: T[] | null; error: { message: string } | null }>
      )
    )
  );
  return pages.flat();
}
