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

type OccRow = {
  id: string;
  occurrence_date: string;
  status: string;
  lesson_id: string;
  lesson_number?: number | null;
};

async function loadOccurrencePages(
  supabase: SupabaseClient,
  opts: {
    lessonChunks: string[][];
    lessonId?: string;
    fromDate?: string;
    toDate?: string;
    includeCancelled: boolean;
    withHour: boolean;
  }
): Promise<OccRow[]> {
  const pages = await Promise.all(
    opts.lessonChunks.map((chunk) =>
      fetchAllPages<OccRow>((from, to) =>
        occurrenceQuery(supabase, {
          lessonIds: chunk,
          lessonId: opts.lessonId,
          fromDate: opts.fromDate,
          toDate: opts.toDate,
          includeCancelled: opts.includeCancelled,
          withHour: opts.withHour,
          from,
          to,
        }) as PromiseLike<{ data: OccRow[] | null; error: { message: string } | null }>
      )
    )
  );
  return pages.flat();
}

/** Month/day calendar: one date-range query instead of chunking every lesson id. */
async function loadOccurrencesByDateRange(
  supabase: SupabaseClient,
  opts: {
    yearLessonIds: string[];
    fromDate: string;
    toDate: string;
    includeCancelled: boolean;
    withHour: boolean;
  }
): Promise<OccRow[]> {
  const yearSet = new Set(opts.yearLessonIds);
  const columns = opts.withHour
    ? "id, occurrence_date, status, lesson_number, lesson_id"
    : "id, occurrence_date, status, lesson_id";
  const rows = await fetchAllPages<OccRow>((from, to) => {
    let query = supabase
      .from("lesson_occurrences")
      .select(columns)
      .gte("occurrence_date", opts.fromDate)
      .lte("occurrence_date", opts.toDate)
      .order("occurrence_date")
      .range(from, to);
    if (!opts.includeCancelled) query = query.neq("status", "cancelled");
    return query as PromiseLike<{ data: OccRow[] | null; error: { message: string } | null }>;
  });
  return rows.filter((row) => yearSet.has(row.lesson_id));
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
  if (!lessonId && opts.yearLessonIds.length === 0) return [];
  if (lessonId && lessonChunks.length === 0) return [];

  const probeChunk = lessonId ? [lessonId] : opts.yearLessonIds.slice(0, 1);
  const probe = await occurrenceQuery(supabase, {
    lessonIds: probeChunk,
    lessonId,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    includeCancelled,
    withHour: true,
    from: 0,
    to: 0,
  });
  const withHour = !(probe.error && isMissingOccurrenceHourColumn(probe.error));

  if (!lessonId && opts.fromDate && opts.toDate) {
    return asSkinny(
      await loadOccurrencesByDateRange(supabase, {
        yearLessonIds: opts.yearLessonIds,
        fromDate: opts.fromDate,
        toDate: opts.toDate,
        includeCancelled,
        withHour,
      })
    );
  }

  return asSkinny(
    await loadOccurrencePages(supabase, {
      lessonChunks: lessonChunks.length > 0 ? lessonChunks : [[]],
      lessonId,
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      includeCancelled,
      withHour,
    })
  );
}

export async function fetchAttendanceForOccurrences<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  occurrenceIds: string[],
  columns: string,
  studentIds?: string | string[]
): Promise<T[]> {
  if (occurrenceIds.length === 0) return [];
  const studentFilter = Array.isArray(studentIds)
    ? studentIds.filter(Boolean)
    : studentIds
      ? [studentIds]
      : [];
  const pages = await Promise.all(
    chunkIds(occurrenceIds).map((chunk) =>
      fetchAllPages<T>((from, to) => {
        let query = supabase
          .from("attendance")
          .select(columns)
          .in("lesson_occurrence_id", chunk);
        if (studentFilter.length === 1) query = query.eq("student_id", studentFilter[0]);
        else if (studentFilter.length > 1) query = query.in("student_id", studentFilter);
        return query.range(from, to) as PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>;
      })
    )
  );
  return pages.flat();
}
