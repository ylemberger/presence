import { createClient } from "@/lib/supabase/server";
import { parseIsoDate, toIsoDate } from "@/lib/dates/hebrew";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/paged";
import { occupiedLessonNumbers } from "@/lib/lessons/hours";
import { fetchHolidayDateSet, holidayDateSet, isMissingHolidayTable } from "./holidays";
import {
  primarySlot,
  slotsFromLessonAndRows,
  type WeeklySlot,
  type WeeklySlotRow,
} from "./weekly-slots";

export const OCCURRENCE_HOUR_PATCH =
  "כל שעה היא מפגש נוכחות נפרד. הריצי supabase/patches/031_occurrence_per_hour.sql ואז נסי שוב.";

export function isMissingOccurrenceHourColumn(
  error: { message?: string; code?: string } | null
): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /lesson_number/i.test(msg) && /lesson_occurrences|schema cache|PGRST204/i.test(msg);
}

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

/** One key per attendance meeting: date + the single hour. */
function expectedMeetingKeys(
  startDate: string,
  endDate: string,
  slots: WeeklySlot[],
  holidays: Set<string>,
  everyWeeks = 1
): Set<string> {
  const keys = new Set<string>();
  for (const slot of slots) {
    const hours = occupiedLessonNumbers(slot.lessonNumber, slot.periodCount);
    for (const date of getDatesForDayOfWeek(startDate, endDate, slot.dayOfWeek, everyWeeks)) {
      if (holidays.has(date)) continue;
      for (const hour of hours) keys.add(`${date}|${hour}`);
    }
  }
  return keys;
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

  const hourProbe = await supabase.from("lesson_occurrences").select("lesson_number").limit(1);
  if (hourProbe.error && isMissingOccurrenceHourColumn(hourProbe.error)) {
    throw new Error(OCCURRENCE_HOUR_PATCH);
  }

  const rowsToInsert: {
    lesson_id: string;
    occurrence_date: string;
    lesson_number: number;
    status: "scheduled";
  }[] = [];

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

    const existingRows = await fetchAllPages<{
      occurrence_date: string;
      lesson_number: number | null;
    }>((from, to) =>
      supabase
        .from("lesson_occurrences")
        .select("occurrence_date, lesson_number")
        .eq("lesson_id", lesson.id)
        .gte("occurrence_date", range.start_date)
        .lte("occurrence_date", range.end_date)
        .order("occurrence_date")
        .order("lesson_number")
        .range(from, to)
    );

    const openDates = new Set(dates);
    const existingSet = new Set(
      existingRows.map((row) => `${row.occurrence_date}|${row.lesson_number ?? ""}`)
    );
    for (const slot of slots) {
      const hours = occupiedLessonNumbers(slot.lessonNumber, slot.periodCount);
      for (const date of getDatesForDayOfWeek(
        range.start_date,
        range.end_date,
        slot.dayOfWeek,
        everyWeeks
      )) {
        if (!openDates.has(date)) continue;
        for (const hour of hours) {
          const key = `${date}|${hour}`;
          if (existingSet.has(key)) {
            result.skipped++;
            continue;
          }
          rowsToInsert.push({
            lesson_id: lesson.id,
            occurrence_date: date,
            lesson_number: hour,
            status: "scheduled",
          });
        }
      }
    }
  }

  const chunkSize = 200;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);
    const { error: insertError } = await supabase.from("lesson_occurrences").insert(chunk);
    if (insertError) {
      if (isMissingOccurrenceHourColumn(insertError)) {
        throw new Error(OCCURRENCE_HOUR_PATCH);
      }
      if (insertError.code === "23505") {
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from("lesson_occurrences").insert(row);
          if (!oneErr) result.created++;
          else if (oneErr.code === "23505") result.skipped++;
          else if (isMissingOccurrenceHourColumn(oneErr)) throw new Error(OCCURRENCE_HOUR_PATCH);
          else throw new Error("יצירת המופעים נכשלה");
        }
        continue;
      }
      throw new Error("יצירת המופעים נכשלה");
    }
    result.created += chunk.length;
  }

  return result;
}

/** One calendar date of a lesson: a meeting for every hour in that day's span. */
export async function addOccurrenceMeetingsForDate(
  supabase: SupabaseClient,
  lessonId: string,
  date: string
): Promise<{ occurrenceId: string }> {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, day_of_week, lesson_number, period_count")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError || !lesson) throw new Error("השיעור לא נמצא");

  const slotsByLesson = await loadSlotsForLessons(supabase, [lessonId]);
  const slots = slotsFromLessonAndRows(lesson, slotsByLesson.get(lessonId));
  const weekday = parseIsoDate(date).getDay();
  const slot = slots.find((item) => item.dayOfWeek === weekday) ?? primarySlot(slots);
  const hours = occupiedLessonNumbers(slot.lessonNumber, slot.periodCount);

  const { data: existing, error: existingError } = await supabase
    .from("lesson_occurrences")
    .select("id, status, lesson_number")
    .eq("lesson_id", lessonId)
    .eq("occurrence_date", date);
  if (existingError) {
    if (isMissingOccurrenceHourColumn(existingError)) throw new Error(OCCURRENCE_HOUR_PATCH);
    throw new Error("לא ניתן לקרוא את מפגשי היום");
  }

  const byHour = new Map<number, { id: string; status: string }>();
  for (const row of existing ?? []) {
    if (row.lesson_number == null) continue;
    byHour.set(row.lesson_number, { id: row.id, status: row.status });
  }

  let firstId = "";
  for (const hour of hours) {
    const found = byHour.get(hour);
    if (found) {
      if (found.status === "cancelled") {
        const { error } = await supabase
          .from("lesson_occurrences")
          .update({ status: "scheduled", gap_handling: null })
          .eq("id", found.id);
        if (error) throw new Error("לא ניתן לפתוח מחדש את המפגש");
      }
      if (!firstId) firstId = found.id;
      continue;
    }

    const { data: created, error } = await supabase
      .from("lesson_occurrences")
      .insert({
        lesson_id: lessonId,
        occurrence_date: date,
        lesson_number: hour,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: again } = await supabase
        .from("lesson_occurrences")
        .select("id")
        .eq("lesson_id", lessonId)
        .eq("occurrence_date", date)
        .eq("lesson_number", hour)
        .maybeSingle();
      if (!again?.id) throw new Error("הוספת המפגש נכשלה");
      if (!firstId) firstId = again.id;
      continue;
    }
    if (error && isMissingOccurrenceHourColumn(error)) throw new Error(OCCURRENCE_HOUR_PATCH);
    if (error || !created) throw new Error("הוספת המפגש נכשלה");
    if (!firstId) firstId = created.id;
  }

  if (!firstId) throw new Error("הוספת המפגש נכשלה");
  return { occurrenceId: firstId };
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
  const expected = expectedMeetingKeys(
    range.start_date,
    range.end_date,
    slots,
    holidays,
    everyWeeks
  );

  const occs = await fetchAllPages<{
    id: string;
    occurrence_date: string;
    status: string;
    lesson_number: number | null;
  }>((from, to) =>
    supabase
      .from("lesson_occurrences")
      .select("id, occurrence_date, status, lesson_number")
      .eq("lesson_id", lessonId)
      .order("occurrence_date")
      .order("lesson_number")
      .range(from, to)
  );

  const stale = occs.filter((o) => {
    if (o.status === "cancelled" || o.lesson_number == null) return false;
    return !expected.has(`${o.occurrence_date}|${o.lesson_number}`);
  });
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
