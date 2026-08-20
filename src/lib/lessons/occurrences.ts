import { createClient } from "@/lib/supabase/server";

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
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current.getDay() !== dayOfWeek && current <= end) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
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
    .select("*, activity_ranges(start_date, end_date)");

  if (lessonId) {
    lessonsQuery = lessonsQuery.eq("id", lessonId);
  } else if (academicYearId) {
    lessonsQuery = lessonsQuery.eq("academic_year_id", academicYearId);
  }

  const { data: lessons, error } = await lessonsQuery;
  if (error) throw error;
  if (!lessons?.length) return result;

  for (const lesson of lessons) {
    const range = lesson.activity_ranges as { start_date: string; end_date: string } | null;
    if (!range) continue;

    const dates = getDatesForDayOfWeek(range.start_date, range.end_date, lesson.day_of_week);

    for (const date of dates) {
      const { data: existing } = await supabase
        .from("lesson_occurrences")
        .select("id")
        .eq("lesson_id", lesson.id)
        .eq("occurrence_date", date)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("lesson_occurrences").insert({
        lesson_id: lesson.id,
        occurrence_date: date,
        status: "scheduled",
      });

      if (!insertError) result.created++;
    }
  }

  return result;
}
