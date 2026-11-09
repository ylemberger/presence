import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds } from "@/lib/supabase/paged";
import { hebrewDbError } from "@/lib/db/hebrew-error";

const PAGE = 1000;

/**
 * Delete a student's attendance marks on the given lessons.
 * When fromDate is set, only meetings on/after that day are scrubbed
 * (backdated placement transfer). Without fromDate — every mark on those lessons.
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
  const attendanceIds: string[] = [];

  for (const lessonChunk of chunkIds(uniqueLessonIds)) {
    for (let from = 0; from < 50000; from += PAGE) {
      let query = supabase
        .from("attendance")
        .select("id, lesson_occurrences!inner(lesson_id, occurrence_date)")
        .eq("student_id", studentId)
        .in("lesson_occurrences.lesson_id", lessonChunk)
        .order("id")
        .range(from, from + PAGE - 1);
      if (fromDate) {
        query = query.gte("lesson_occurrences.occurrence_date", fromDate);
      }
      const { data, error } = await query;
      if (error) {
        return {
          deleted: 0,
          error: hebrewDbError(error, "מחיקת סימוני הנוכחות נכשלה"),
        };
      }
      const batch = data ?? [];
      for (const row of batch) attendanceIds.push(row.id);
      if (batch.length < PAGE) break;
    }
  }

  if (attendanceIds.length === 0) return { deleted: 0 };

  let deleted = 0;
  for (const idChunk of chunkIds(attendanceIds)) {
    const { data, error, count } = await supabase
      .from("attendance")
      .delete({ count: "exact" })
      .in("id", idChunk)
      .select("id");
    if (error) {
      return {
        deleted,
        error: hebrewDbError(error, "מחיקת סימוני הנוכחות נכשלה"),
      };
    }
    const n = data?.length ?? count ?? 0;
    deleted += n;
    if (n !== idChunk.length) {
      return {
        deleted,
        error: "לא כל סימוני הנוכחות נמחקו. נסי שוב.",
      };
    }
  }

  return { deleted };
}
