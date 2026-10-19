import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

/** PostgREST returns at most 1000 rows unless the query is paged. */
export async function fetchAllPages<T>(
  load: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("paged select failed");
      break;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export function chunkIds(ids: string[], size = 80): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

/** Every matching lesson link, past the default 1000-row cap. */
export async function fetchAssignmentsByLessons<T>(
  supabase: SupabaseClient,
  lessonIds: string[],
  columns: string,
  openOnly = false
): Promise<T[]> {
  if (lessonIds.length === 0) return [];
  const pages = await Promise.all(
    chunkIds(lessonIds).map((chunk) =>
      fetchAllPages<T>((from, to) => {
        let query = supabase
          .from("student_lesson_assignments")
          .select(columns)
          .in("lesson_id", chunk);
        if (openOnly) query = query.is("end_date", null);
        return query.range(from, to) as PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>;
      })
    )
  );
  return pages.flat();
}
