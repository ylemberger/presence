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

/** Small Gregorian day+month for calendar cells, e.g. 21.08 */
export function formatGregorianDayMonth(date: string | Date | null | undefined): string {
  const full = formatGregorianDate(date);
  const parts = full.split(".");
  if (parts.length < 2) return full;
  return `${parts[0]}.${parts[1]}`;
}

/** Small Gregorian range for a Hebrew month header. */
export function formatGregorianRange(start: string, end: string): string {
  const a = formatGregorianDate(start);
  const b = formatGregorianDate(end);
  if (!a || !b) return a || b;
  if (a === b) return a;
  const [ad, am, ay] = a.split(".");
  const [bd, bm, by] = b.split(".");
  if (ay === by && am === bm) return `${ad}–${bd}.${am}.${ay}`;
  if (ay === by) return `${ad}.${am}–${bd}.${bm}.${ay}`;
  return `${a} – ${b}`;
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

const HEBREW_LETTER_VALUES: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  כ: 20,
  ל: 30,
  מ: 40,
  נ: 50,
  ס: 60,
  ע: 70,
  פ: 80,
  צ: 90,
  ק: 100,
  ר: 200,
  ש: 300,
  ת: 400,
  ך: 20,
  ם: 40,
  ן: 50,
  ף: 80,
  ץ: 90,
};

export function hebrewGematria(text: string): number {
  return [...text.replace(/[״"׳'\s]/g, "")].reduce(
    (sum, ch) => sum + (HEBREW_LETTER_VALUES[ch] ?? 0),
    0
  );
}

function parseDayToken(token: string): number | null {
  const t = token.replace(/[״"׳']/g, "").trim();
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 30 ? n : null;
  }
  const g = hebrewGematria(t);
  return g >= 1 && g <= 30 ? g : null;
}

function parseYearToken(token: string, fallbackYear: number): number {
  const t = token.replace(/[״"׳']/g, "").trim();
  if (/^\d{4}$/.test(t)) return Number(t);
  const g = hebrewGematria(t);
  if (g >= 5000 && g <= 6000) return g;
  if (g >= 1 && g < 1000) return 5000 + g;
  return fallbackYear;
}

function findHebrewMonthNumber(year: number, token: string): number | null {
  const aliases: Record<string, string> = {
    חשוון: "חשון",
    מרחשון: "חשון",
    מרחשוון: "חשון",
    סיוון: "סיון",
  };
  const needle = aliases[token.replace(/[״"׳'\s]/g, "")] ?? token.replace(/[״"׳'\s]/g, "");
  if (!needle) return null;
  const options = hebrewMonthOptionsForYear(year);
  const exact = options.find((opt) => opt.label.replace(/[״"׳'\s]/g, "") === needle);
  if (exact) return exact.month;
  const partial = options.find((opt) => {
    const label = opt.label.replace(/[״"׳'\s]/g, "");
    return label.includes(needle) || needle.includes(label);
  });
  return partial?.month ?? null;
}

/**
 * Accepts ISO, Gregorian (15.8.2026 / 15/8/2026), a day in the current Hebrew
 * month (15 / ט״ו), or a Hebrew date like "ט״ו אלול תשפ״ו".
 */
export function parseFlexibleDate(raw: string, contextIso = todayIso()): string | null {
  const text = raw.trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    try {
      isoToHDate(text);
      return text;
    } catch {
      return null;
    }
  }

  const greg = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (greg) {
    let year = Number(greg[3]);
    if (year < 100) year += 2000;
    const month = Number(greg[2]);
    const day = Number(greg[1]);
    const dt = new Date(year, month - 1, day, 12, 0, 0);
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return toIsoDate(dt);
    }
    return null;
  }

  const ctx = hebrewMonthFromIso(contextIso);
  const tokens = text.split(/\s+/).filter(Boolean);

  if (tokens.length === 1) {
    const day = parseDayToken(tokens[0]);
    if (!day) return null;
    const max = daysInHebrewMonth(ctx.year, ctx.month);
    if (day > max) return null;
    return hDateToIso(new HDate(day, ctx.month, ctx.year));
  }

  const day = parseDayToken(tokens[0]);
  if (!day) return null;
  const year = tokens.length >= 3 ? parseYearToken(tokens[tokens.length - 1], ctx.year) : ctx.year;
  const monthToken = tokens.slice(1, tokens.length >= 3 ? -1 : undefined).join(" ");
  const month = findHebrewMonthNumber(year, monthToken) ?? ctx.month;
  const max = daysInHebrewMonth(year, month);
  if (day > max) return null;
  return hDateToIso(new HDate(day, month, year));
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

/** Sunday-start week (ISO date of that week's Sunday). */
export function startOfWeekSunday(iso: string): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() - date.getDay());
  return toIsoDate(date);
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
