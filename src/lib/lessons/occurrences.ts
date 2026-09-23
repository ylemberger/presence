import { createClient } from "@/lib/supabase/server";
import { parseIsoDate, toIsoDate } from "@/lib/dates/hebrew";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchHolidayDateSet, holidayDateSet, isMissingHolidayTable } from "./holidays";
import {
  slotsFromLessonAndRows,
  type WeeklySlot,
  type WeeklySlotRow,
} from "./weekly-slots";

export interface GenerateOccurrencesResult {
  created: number;
  skipped: number;
}

function getDatesForDayOfWeek(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  everyWeeks = 1
): string[] {
  const stepWeeks = everyWeeks === 2 ? 2 : 1;
  const dates: string[] = [];
  const current = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  while (current.getDay() !== dayOfWeek && current <= end) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    dates.push(toIsoDate(current));
    current.setDate(current.getDate() + 7 * stepWeeks);
  }

  return dates;
}

function datesForSlots(
  startDate: string,
  endDate: string,
  slots: WeeklySlot[],
  holidays: Set<string>,
  everyWeeks = 1
): string[] {
  const dates = new Set<string>();
  for (const slot of slots) {
    for (const date of getDatesForDayOfWeek(
      startDate,
      endDate,
      slot.dayOfWeek,
      everyWeeks
    )) {
      if (!holidays.has(date)) dates.add(date);
    }
  }
  return [...dates].sort();
}

function isMissingWeeklySlotsTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /lesson_weekly_slots|schema cache|PGRST205|42P01/i.test(msg);
}

async function loadSlotsForLessons(
  supabase: SupabaseClient,
  lessonIds: string[]
): Promise<Map<string, WeeklySlotRow[]>> {
  const map = new Map<string, WeeklySlotRow[]>();
  if (lessonIds.length === 0) return map;
  const { data, error } = await supabase
    .from("lesson_weekly_slots")
    .select("lesson_id, day_of_week, lesson_number, period_count")
    .in("lesson_id", lessonIds);
  if (error) {
    if (isMissingWeeklySlotsTable(error)) return map;
    throw error;
  }
  for (const row of data ?? []) {
    const list = map.get(row.lesson_id) ?? [];
    list.push({
      day_of_week: row.day_of_week,
      lesson_number: row.lesson_number,
      period_count: row.period_count,
    });
    map.set(row.lesson_id, list);
  }
  return map;
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
    .select(
      "id, subject, day_of_week, lesson_number, period_count, repeat_every_weeks, academic_year_id, activity_ranges(start_date, end_date)"
    );

  if (lessonId) {
    lessonsQuery = lessonsQuery.eq("id", lessonId);
  } else if (academicYearId) {
    lessonsQuery = lessonsQuery.eq("academic_year_id", academicYearId);
  }

  let { data: lessons, error } = await lessonsQuery;
  if (error && /repeat_every_weeks/i.test(error.message)) {
    let fallback = supabase
      .from("lessons")
      .select(
        "id, subject, day_of_week, lesson_number, period_count, academic_year_id, activity_ranges(start_date, end_date)"
      );
    if (lessonId) fallback = fallback.eq("id", lessonId);
    else if (academicYearId) fallback = fallback.eq("academic_year_id", academicYearId);
    const retry = await fallback;
    lessons = (retry.data ?? []).map((row) => ({ ...row, repeat_every_weeks: 1 }));
    error = retry.error;
  }
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
  const slotsByLesson = await loadSlotsForLessons(
    supabase,
    lessons.map((l) => l.id)
  );

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

    const slots = slotsFromLessonAndRows(lesson, slotsByLesson.get(lesson.id));
    const everyWeeks =
      lesson.repeat_every_weeks === 2 ? 2 : 1;
    const holidays = holidaysByYear.get(lesson.academic_year_id) ?? new Set<string>();
    const candidateDates = slots.flatMap((slot) =>
      getDatesForDayOfWeek(range.start_date, range.end_date, slot.dayOfWeek, everyWeeks)
    );
    if (candidateDates.length === 0) {
      throw new Error(
        `לא נוצרו מופעים לשיעור "${lesson.subject}" — אין תאריכים תואמים בטווח הפעילות לימים שנבחרו`
      );
    }

    const dates = datesForSlots(
      range.start_date,
      range.end_date,
      slots,
      holidays,
      everyWeeks
    );
    if (dates.length === 0) {
      result.skipped += new Set(candidateDates).size;
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

/** After editing a lesson: create missing dates, then drop/cancel dates that no longer belong. */
export async function syncLessonOccurrences(
  lessonId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());
  const gen = await generateLessonOccurrences(lessonId, undefined, supabase);

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      "id, day_of_week, lesson_number, period_count, repeat_every_weeks, academic_year_id, activity_ranges(start_date, end_date)"
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError) throw lessonError;
  if (!lesson) return { ...gen, removed: 0, cancelled: 0 };

  const rawRange = lesson.activity_ranges as unknown;
  const range = (Array.isArray(rawRange) ? rawRange[0] : rawRange) as {
    start_date: string;
    end_date: string;
  } | null;
  if (!range) return { ...gen, removed: 0, cancelled: 0 };

  const holidaysByYear = await fetchHolidayDateSet(supabase, [lesson.academic_year_id]);
  const holidays = holidaysByYear.get(lesson.academic_year_id) ?? new Set<string>();
  const slotsByLesson = await loadSlotsForLessons(supabase, [lessonId]);
  const slots = slotsFromLessonAndRows(lesson, slotsByLesson.get(lessonId));
  const everyWeeks = lesson.repeat_every_weeks === 2 ? 2 : 1;
  const expected = new Set(
    datesForSlots(range.start_date, range.end_date, slots, holidays, everyWeeks)
  );

  const { data: occs, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, status")
    .eq("lesson_id", lessonId);
  if (occError) throw occError;

  const stale = (occs ?? []).filter(
    (o) => !expected.has(o.occurrence_date) && o.status !== "cancelled"
  );
  if (stale.length === 0) {
    return { created: gen.created, skipped: gen.skipped, removed: 0, cancelled: 0 };
  }

  const ids = stale.map((o) => o.id);
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
    .select("start_date, end_date");
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

/** Shared holiday calendar — refresh occurrences for every academic year. */
export async function applyHolidaysToAllOccurrences(supabase: SupabaseClient) {
  const { data: years, error } = await supabase.from("academic_years").select("id");
  if (error) throw error;
  let created = 0;
  let skipped = 0;
  let removed = 0;
  let cancelled = 0;
  for (const year of years ?? []) {
    const result = await applyHolidaysToYearOccurrences(year.id, supabase);
    created += result.created;
    skipped += result.skipped;
    removed += result.removed;
    cancelled += result.cancelled;
  }
  return { created, skipped, removed, cancelled };
}
