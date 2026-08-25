import { expandIsoRange } from "@/lib/dates/hebrew";
import type { SupabaseClient } from "@supabase/supabase-js";

export { expandIsoRange };

export interface HolidayRange {
  start_date: string;
  end_date: string;
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
  if (error) throw error;

  for (const row of data ?? []) {
    const set = map.get(row.academic_year_id) ?? new Set<string>();
    for (const date of expandIsoRange(row.start_date, row.end_date)) {
      set.add(date);
    }
    map.set(row.academic_year_id, set);
  }
  return map;
}
