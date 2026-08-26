import { addDays, expandIsoRange } from "@/lib/dates/hebrew";
import type { HolidayKind } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export { expandIsoRange };

export interface HolidayRange {
  start_date: string;
  end_date: string;
  kind?: HolidayKind | string | null;
}

export function holidayDateSet(periods: HolidayRange[]): Set<string> {
  const set = new Set<string>();
  for (const period of periods) {
    for (const date of expandIsoRange(period.start_date, period.end_date)) {
      set.add(date);
    }
  }
  return set;
}

export function holidayDatesByKind(periods: HolidayRange[]): {
  vacation: string[];
  cancelled: string[];
} {
  const vacation = new Set<string>();
  const cancelled = new Set<string>();
  for (const period of periods) {
    const target = period.kind === "cancelled_studies" ? cancelled : vacation;
    for (const date of expandIsoRange(period.start_date, period.end_date)) {
      target.add(date);
    }
  }
  return { vacation: [...vacation], cancelled: [...cancelled] };
}

export function isMissingHolidayTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /holiday_periods|schema cache|PGRST205|42P01/i.test(msg);
}

export function isMissingHolidayKind(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /holiday_periods.*kind|column.*kind|PGRST204/i.test(msg);
}

export async function fetchHolidayDateSet(
  supabase: SupabaseClient,
  academicYearIds: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const ids = [...new Set(academicYearIds.filter(Boolean))];
  for (const id of ids) map.set(id, new Set());
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("holiday_periods")
    .select("academic_year_id, start_date, end_date")
    .in("academic_year_id", ids);
  if (error) {
    if (isMissingHolidayTable(error)) return map;
    throw error;
  }

  for (const row of data ?? []) {
    const set = map.get(row.academic_year_id) ?? new Set<string>();
    for (const date of expandIsoRange(row.start_date, row.end_date)) {
      set.add(date);
    }
    map.set(row.academic_year_id, set);
  }
  return map;
}

type PeriodRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  kind: string | null;
};

function coversDate(period: PeriodRow, iso: string): boolean {
  return period.start_date <= iso && period.end_date >= iso;
}

/** Paint or erase one calendar day. Same kind on an existing day removes it. */
export async function toggleHolidayDate(
  supabase: SupabaseClient,
  academicYearId: string,
  iso: string,
  kind: HolidayKind,
  name: string
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("holiday_periods")
    .select("id, name, start_date, end_date, kind")
    .eq("academic_year_id", academicYearId);
  if (error) {
    if (isMissingHolidayTable(error)) {
      return { error: "טבלת החופשות עדיין לא קיימת. הריצי את patch 005 ואז 009." };
    }
    if (isMissingHolidayKind(error)) {
      return { error: "יש להריץ ב-Supabase את הקובץ supabase/patches/009_holiday_kinds_and_student_notes.sql" };
    }
    return { error: "קריאת לוח החופשות נכשלה" };
  }

  const covering = (data ?? []).filter((row) => coversDate(row as PeriodRow, iso));
  const sameKind = covering.find((row) => (row.kind || "vacation") === kind);

  if (sameKind) {
    const split = await removeDateFromPeriod(supabase, sameKind as PeriodRow, iso, academicYearId);
    if (split.error) return split;
    return {};
  }

  for (const row of covering) {
    const split = await removeDateFromPeriod(supabase, row as PeriodRow, iso, academicYearId);
    if (split.error) return split;
  }

  const { error: insertError } = await supabase.from("holiday_periods").insert({
    academic_year_id: academicYearId,
    name,
    start_date: iso,
    end_date: iso,
    kind,
  });
  if (insertError) {
    if (isMissingHolidayKind(insertError)) {
      return { error: "יש להריץ ב-Supabase את הקובץ supabase/patches/009_holiday_kinds_and_student_notes.sql" };
    }
    return { error: "שמירת היום נכשלה" };
  }
  return {};
}

async function removeDateFromPeriod(
  supabase: SupabaseClient,
  period: PeriodRow,
  iso: string,
  academicYearId: string
): Promise<{ error?: string }> {
  if (period.start_date === iso && period.end_date === iso) {
    const { error } = await supabase.from("holiday_periods").delete().eq("id", period.id);
    if (error) return { error: "מחיקת היום נכשלה" };
    return {};
  }

  if (period.start_date === iso) {
    const { error } = await supabase
      .from("holiday_periods")
      .update({ start_date: addDays(iso, 1) })
      .eq("id", period.id);
    if (error) return { error: "עדכון הטווח נכשל" };
    return {};
  }

  if (period.end_date === iso) {
    const { error } = await supabase
      .from("holiday_periods")
      .update({ end_date: addDays(iso, -1) })
      .eq("id", period.id);
    if (error) return { error: "עדכון הטווח נכשל" };
    return {};
  }

  const { error: updateError } = await supabase
    .from("holiday_periods")
    .update({ end_date: addDays(iso, -1) })
    .eq("id", period.id);
  if (updateError) return { error: "עדכון הטווח נכשל" };

  const { error: insertError } = await supabase.from("holiday_periods").insert({
    academic_year_id: academicYearId,
    name: period.name,
    start_date: addDays(iso, 1),
    end_date: period.end_date,
    kind: period.kind || "vacation",
  });
  if (insertError) return { error: "פיצול הטווח נכשל" };
  return {};
}
