import { HDate } from "@hebcal/core";

const HEBREW_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoToHDate(iso: string): HDate {
  return new HDate(parseIsoDate(iso));
}

export function hDateToIso(hd: HDate): string {
  return toIsoDate(hd.greg());
}

export function formatHebrewDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const iso = typeof date === "string" ? date.slice(0, 10) : toIsoDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(date);
  try {
    return isoToHDate(iso).renderGematriya(true);
  } catch {
    return iso;
  }
}

/** Gregorian display under Hebrew primary, e.g. 21.08.2026 */
export function formatGregorianDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const iso = typeof date === "string" ? date.slice(0, 10) : toIsoDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(date);
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatDatePair(date: string | Date | null | undefined): {
  hebrew: string;
  gregorian: string;
} {
  return {
    hebrew: formatHebrewDate(date),
    gregorian: formatGregorianDate(date),
  };
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export interface HebrewMonthDay {
  iso: string;
  day: number;
  label: string;
  weekday: number;
  inMonth: boolean;
}

export interface HebrewMonthGrid {
  year: number;
  month: number;
  title: string;
  days: HebrewMonthDay[];
  rangeStart: string;
  rangeEnd: string;
}

export function buildHebrewMonth(year: number, month: number): HebrewMonthGrid {
  const first = new HDate(1, month, year);
  const daysInMonth = first.daysInMonth();
  const title = first.renderGematriya(true).replace(/^א׳\s*/, "");

  const days: HebrewMonthDay[] = [];
  const firstWeekday = first.getDay();

  for (let i = 0; i < firstWeekday; i++) {
    days.push({
      iso: "",
      day: 0,
      label: "",
      weekday: i,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const hd = new HDate(day, month, year);
    const iso = hDateToIso(hd);
    days.push({
      iso,
      day,
      label: hd.renderGematriya(true).split(" ")[0],
      weekday: hd.getDay(),
      inMonth: true,
    });
  }

  return {
    year,
    month,
    title,
    days,
    rangeStart: hDateToIso(first),
    rangeEnd: hDateToIso(new HDate(daysInMonth, month, year)),
  };
}

export function hebrewMonthFromIso(iso: string): { year: number; month: number } {
  const hd = isoToHDate(iso);
  return { year: hd.getFullYear(), month: hd.getMonth() };
}

export function shiftHebrewMonth(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const hd = new HDate(1, month, year).add(delta > 0 ? 32 : -1, "d");
  const start = new HDate(1, hd.getMonth(), hd.getFullYear());
  return { year: start.getFullYear(), month: start.getMonth() };
}

export function hebrewWeekdayLabels(): readonly string[] {
  return HEBREW_WEEKDAYS;
}

export function hebrewMonthOptionsAround(iso: string, before = 18, after = 18): Array<{
  year: number;
  month: number;
  label: string;
  value: string;
}> {
  const start = hebrewMonthFromIso(iso);
  let cursor = { year: start.year, month: start.month };
  for (let i = 0; i < before; i++) {
    cursor = shiftHebrewMonth(cursor.year, cursor.month, -1);
  }
  const options: Array<{ year: number; month: number; label: string; value: string }> = [];
  const total = before + after + 1;
  for (let i = 0; i < total; i++) {
    const first = new HDate(1, cursor.month, cursor.year);
    options.push({
      year: cursor.year,
      month: cursor.month,
      label: first.renderGematriya(true).replace(/^א׳\s*/, ""),
      value: `${cursor.year}-${cursor.month}`,
    });
    cursor = shiftHebrewMonth(cursor.year, cursor.month, 1);
  }
  return options;
}

export function daysInHebrewMonth(year: number, month: number): number {
  return new HDate(1, month, year).daysInMonth();
}

export function hebrewMonthsInYear(year: number): number {
  let count = 12;
  for (let month = 1; month <= 14; month++) {
    try {
      const hd = new HDate(1, month, year);
      if (hd.getFullYear() !== year) break;
      count = month;
    } catch {
      break;
    }
  }
  return count;
}

export function hebrewMonthOptionsForYear(year: number): Array<{
  month: number;
  label: string;
}> {
  const total = hebrewMonthsInYear(year);
  const options: Array<{ month: number; label: string }> = [];
  for (let month = 1; month <= total; month++) {
    const first = new HDate(1, month, year);
    options.push({
      month,
      label: first.renderGematriya(true).replace(/^א׳\s*/, ""),
    });
  }
  return options;
}

export function hebrewYearOptions(centerIso: string, span = 20): Array<{
  year: number;
  label: string;
}> {
  const centerYear = isoToHDate(centerIso).getFullYear();
  const options: Array<{ year: number; label: string }> = [];
  for (let year = centerYear - span; year <= centerYear + span; year++) {
    const sample = new HDate(1, 7, year);
    const parts = sample.renderGematriya(true).split(" ");
    options.push({
      year,
      label: parts[parts.length - 1] ?? String(year),
    });
  }
  return options;
}

export function isIsoInRange(iso: string, start: string, end: string): boolean {
  if (!start) return false;
  const bound = end || start;
  const lo = start <= bound ? start : bound;
  const hi = start <= bound ? bound : start;
  return iso >= lo && iso <= hi;
}

export function formatDate(date: string | Date | null | undefined): string {
  return formatHebrewDate(date);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days, 12, 0, 0);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function expandIsoRange(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string | null
): boolean {
  return date >= startDate && (endDate === null || date <= endDate);
}
