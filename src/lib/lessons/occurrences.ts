import { createClient } from "@/lib/supabase/server";
import { parseIsoDate, toIsoDate } from "@/lib/dates/hebrew";

export interface GenerateOccurrencesResult {
  created: number;
  skipped: number;
}

function getDatesForDayOfWeek(
  startDate: string,
  endDate: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = [];
  const current = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  while (current.getDay() !== dayOfWeek && current <= end) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    dates.push(toIsoDate(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

export async function generateLessonOccurrences(
  lessonId?: string,
  academicYearId?: string
): Promise<GenerateOccurrencesResult> {
  const supabase = await createClient();
  const result: GenerateOccurrencesResult = { created: 0, skipped: 0 };

  let lessonsQuery = supabase
    .from("lessons")
    .select("id, subject, day_of_week, activity_ranges(start_date, end_date)");

  if (lessonId) {
    lessonsQuery = lessonsQuery.eq("id", lessonId);
  } else if (academicYearId) {
    lessonsQuery = lessonsQuery.eq("academic_year_id", academicYearId);
  }

  const { data: lessons, error } = await lessonsQuery;
  if (error) throw error;
  if (!lessons?.length) {
    throw new Error("לא נמצאו שיעורים ליצירת מופעים");
  }

  const rowsToInsert: { lesson_id: string; occurrence_date: string; status: "scheduled" }[] = [];

  for (const lesson of lessons) {
    const rawRange = lesson.activity_ranges as unknown;
    const range = (Array.isArray(rawRange) ? rawRange[0] : rawRange) as {
      start_date: string;
      end_date: string;
    } | null;
    if (!range) {
      throw new Error(`לשיעור "${lesson.subject}" חסר טווח פעילות`);
    }

    const dates = getDatesForDayOfWeek(range.start_date, range.end_date, lesson.day_of_week);
    if (dates.length === 0) {
      throw new Error(
        `לא נוצרו מופעים לשיעור "${lesson.subject}" — אין תאריכים תואמים בטווח הפעילות ליום שנבחר`
      );
    }

    const { data: existing } = await supabase
      .from("lesson_occurrences")
      .select("occurrence_date")
      .eq("lesson_id", lesson.id)
      .in("occurrence_date", dates);

    const existingSet = new Set((existing ?? []).map((e) => e.occurrence_date));
    for (const date of dates) {
      if (existingSet.has(date)) {
        result.skipped++;
        continue;
      }
      rowsToInsert.push({
        lesson_id: lesson.id,
        occurrence_date: date,
        status: "scheduled",
      });
    }
  }

  const chunkSize = 200;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);
    const { error: insertError } = await supabase.from("lesson_occurrences").insert(chunk);
    if (insertError) {
      if (insertError.code === "23505") {
        // Race / partial overlap — insert one-by-one for this chunk only
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from("lesson_occurrences").insert(row);
          if (!oneErr) result.created++;
          else if (oneErr.code === "23505") result.skipped++;
          else throw new Error(oneErr.message);
        }
        continue;
      }
      throw new Error(insertError.message);
    }
    result.created += chunk.length;
  }

  if (result.created === 0 && result.skipped === 0) {
    throw new Error("לא נוצרו מופעי שיעור כלל");
  }

  return result;
}
