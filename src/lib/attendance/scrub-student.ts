import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds, fetchAllPages } from "@/lib/supabase/paged";
import { hebrewDbError } from "@/lib/db/hebrew-error";

/**
 * Delete a student's attendance marks on the given lessons.
 * When fromDate is set, only meetings on/after that day are scrubbed
 * (used after a backdated placement transfer).
 */
export async function deleteStudentAttendanceOnLessons(
  supabase: SupabaseClient,
  studentId: string,
  lessonIds: string[],
  opts?: { fromDate?: string }
): Promise<{ deleted: number; error?: string }> {
  const uniqueLessonIds = [...new Set(lessonIds.filter(Boolean))];
  if (uniqueLessonIds.length === 0) return { deleted: 0 };

  const fromDate = opts?.fromDate?.slice(0, 10);
  const occurrenceIds: string[] = [];
  for (const chunk of chunkIds(uniqueLessonIds)) {
    const rows = await fetchAllPages<{ id: string }>((from, to) => {
      let query = supabase
        .from("lesson_occurrences")
        .select("id")
        .in("lesson_id", chunk)
        .order("id");
      if (fromDate) query = query.gte("occurrence_date", fromDate);
      return query.range(from, to) as PromiseLike<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    });
    for (const row of rows) occurrenceIds.push(row.id);
  }

  if (occurrenceIds.length === 0) return { deleted: 0 };

  let deleted = 0;
  for (const chunk of chunkIds(occurrenceIds)) {
    const { data, error } = await supabase
      .from("attendance")
      .delete()
      .eq("student_id", studentId)
      .in("lesson_occurrence_id", chunk)
      .select("id");
    if (error) {
      return {
        deleted,
        error: hebrewDbError(error, "מחיקת סימוני הנוכחות נכשלה"),
      };
    }
    deleted += data?.length ?? 0;
  }

  return { deleted };
}
