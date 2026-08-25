import { createClient } from "@/lib/supabase/server";
import { parseIsoDate, toIsoDate } from "@/lib/dates/hebrew";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchHolidayDateSet, holidayDateSet, isMissingHolidayTable } from "./holidays";

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
  academicYearId?: string,
  supabaseClient?: SupabaseClient
): Promise<GenerateOccurrencesResult> {
  const supabase = supabaseClient ?? (await createClient());
  const result: GenerateOccurrencesResult = { created: 0, skipped: 0 };

  let lessonsQuery = supabase
    .from("lessons")
    .select("id, subject, day_of_week, academic_year_id, activity_ranges(start_date, end_date)");

  if (lessonId) {
    lessonsQuery = lessonsQuery.eq("id", lessonId);
  } else if (academicYearId) {
    lessonsQuery = lessonsQuery.eq("academic_year_id", academicYearId);
  }

  const { data: lessons, error } = await lessonsQuery;
  if (error) throw error;
  if (!lessons?.length) {
    if (lessonId) {
      throw new Error("לא נמצאו שיעורים ליצירת מופעים");
    }
    return result;
  }

  const yearIds = [
    ...new Set(
      lessons
        .map((lesson) => lesson.academic_year_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const holidaysByYear = await fetchHolidayDateSet(supabase, yearIds);

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

    const weekdayDates = getDatesForDayOfWeek(range.start_date, range.end_date, lesson.day_of_week);
    if (weekdayDates.length === 0) {
      throw new Error(
        `לא נוצרו מופעים לשיעור "${lesson.subject}" — אין תאריכים תואמים בטווח הפעילות ליום שנבחר`
      );
    }

    const holidays = holidaysByYear.get(lesson.academic_year_id) ?? new Set<string>();
    const dates = weekdayDates.filter((date) => !holidays.has(date));
    if (dates.length === 0) {
      result.skipped += weekdayDates.length;
      continue;
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

  return result;
}

async function chunkedIn<T>(
  ids: string[],
  chunkSize: number,
  run: (chunk: string[]) => Promise<T>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(await run(ids.slice(i, i + chunkSize)));
  }
  return out;
}

/**
 * After holiday calendar changes: create missing non-holiday occurrences,
 * then drop (or cancel if attendance exists) occurrences that fall on holidays.
 */
export async function applyHolidaysToYearOccurrences(
  academicYearId: string,
  supabase: SupabaseClient
): Promise<{ created: number; skipped: number; removed: number; cancelled: number }> {
  const gen = await generateLessonOccurrences(undefined, academicYearId, supabase);

  const { data: periods, error: periodError } = await supabase
    .from("holiday_periods")
    .select("start_date, end_date")
    .eq("academic_year_id", academicYearId);
  if (periodError) {
    if (isMissingHolidayTable(periodError)) {
      return { created: gen.created, skipped: gen.skipped, removed: 0, cancelled: 0 };
    }
    throw periodError;
  }

  const holidays = holidayDateSet(periods ?? []);
  if (holidays.size === 0) {
    return { created: gen.created, skipped: gen.skipped, removed: 0, cancelled: 0 };
  }

  const { data: occs, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, status, lessons!inner(academic_year_id)")
    .eq("lessons.academic_year_id", academicYearId);
  if (occError) throw occError;

  const onHoliday = (occs ?? []).filter(
    (o) => holidays.has(o.occurrence_date) && o.status !== "cancelled"
  );
  if (onHoliday.length === 0) {
    return { created: gen.created, skipped: gen.skipped, removed: 0, cancelled: 0 };
  }

  const ids = onHoliday.map((o) => o.id);
  const attended = new Set<string>();
  await chunkedIn(ids, 200, async (chunk) => {
    const { data: att, error } = await supabase
      .from("attendance")
      .select("lesson_occurrence_id")
      .in("lesson_occurrence_id", chunk);
    if (error) throw error;
    for (const row of att ?? []) attended.add(row.lesson_occurrence_id);
  });

  const toDelete = ids.filter((id) => !attended.has(id));
  const toCancel = ids.filter((id) => attended.has(id));
  let removed = 0;
  let cancelled = 0;

  await chunkedIn(toDelete, 200, async (chunk) => {
    const { error } = await supabase.from("lesson_occurrences").delete().in("id", chunk);
    if (error) throw error;
    removed += chunk.length;
  });
  await chunkedIn(toCancel, 200, async (chunk) => {
    const { error } = await supabase
      .from("lesson_occurrences")
      .update({ status: "cancelled" })
      .in("id", chunk);
    if (error) throw error;
    cancelled += chunk.length;
  });

  return { created: gen.created, skipped: gen.skipped, removed, cancelled };
}
