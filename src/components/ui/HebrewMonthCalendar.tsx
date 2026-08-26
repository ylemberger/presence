"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  buildHebrewMonth,
  formatGregorianDate,
  formatGregorianDayMonth,
  formatGregorianRange,
  hebrewMonthFromIso,
  hebrewMonthOptionsForYear,
  hebrewWeekdayLabels,
  hebrewYearOptions,
  shiftHebrewMonth,
  todayIso,
} from "@/lib/dates/hebrew";

export interface HebrewMonthCalendarProps {
  initialMonthIso?: string;
  selectedDate?: string | null;
  /** number of lessons per date (for badge) */
  countsByDate?: Record<string, number>;
  /** dates where all lessons that day are fully marked */
  completeDates?: string[];
  /** dates with lessons that are not fully marked yet */
  partialDates?: string[];
  /** dates with no studies (vacation) */
  holidayDates?: string[];
  /** cancelled study days (different color from vacation) */
  cancelledDates?: string[];
  onSelectDate?: (iso: string) => void;
  onMonthRangeChange?: (rangeStart: string, rangeEnd: string) => void;
  /** Compact month grid used on the attendance screen. */
  compact?: boolean;
}

function lessonCountLabel(count: number) {
  if (count <= 0) return "";
  if (count === 1) return "שיעור אחד";
  return `${count} שיעורים`;
}

export function HebrewMonthCalendar({
  initialMonthIso,
  selectedDate,
  countsByDate = {},
  completeDates = [],
  partialDates = [],
  holidayDates = [],
  cancelledDates = [],
  onSelectDate,
  onMonthRangeChange,
  compact = false,
}: HebrewMonthCalendarProps) {
  const seed = hebrewMonthFromIso(initialMonthIso || selectedDate || todayIso());
  const [cursor, setCursor] = useState(seed);
  const today = todayIso();
  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const cancelledSet = useMemo(() => new Set(cancelledDates), [cancelledDates]);
  const completeSet = useMemo(() => new Set(completeDates), [completeDates]);
  const partialSet = useMemo(() => new Set(partialDates), [partialDates]);

  useEffect(() => {
    if (initialMonthIso) {
      setCursor(hebrewMonthFromIso(initialMonthIso));
    }
  }, [initialMonthIso]);

  const month = useMemo(
    () => buildHebrewMonth(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const yearOptions = useMemo(() => hebrewYearOptions(today, 25), [today]);
  const monthOptions = useMemo(
    () => hebrewMonthOptionsForYear(cursor.year),
    [cursor.year]
  );

  function goTo(year: number, monthNum: number) {
    setCursor({ year, month: monthNum });
    const grid = buildHebrewMonth(year, monthNum);
    onMonthRangeChange?.(grid.rangeStart, grid.rangeEnd);
  }

  function navigate(delta: number) {
    const next = shiftHebrewMonth(cursor.year, cursor.month, delta);
    goTo(next.year, next.month);
  }

  const navSelectClass =
    "rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-label-md text-label-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => navigate(1)}
        className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        aria-label="חודש הבא"
      >
        <Icon name="chevron_right" />
      </button>
      <div className="flex min-w-0 flex-col items-center justify-center gap-1">
        <p className="font-caption text-caption text-on-surface-variant">
          {formatGregorianRange(month.rangeStart, month.rangeEnd)}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
        <select
          className={navSelectClass}
          aria-label="חודש עברי"
          value={cursor.month}
          onChange={(e) => goTo(cursor.year, Number(e.target.value))}
        >
          {monthOptions.map((opt) => (
            <option key={opt.month} value={opt.month}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className={navSelectClass}
          aria-label="שנה עברית"
          value={cursor.year}
          onChange={(e) => {
            const year = Number(e.target.value);
            const months = hebrewMonthOptionsForYear(year);
            const nextMonth = months.some((m) => m.month === cursor.month)
              ? cursor.month
              : (months[0]?.month ?? 1);
            goTo(year, nextMonth);
          }}
        >
          {yearOptions.map((opt) => (
            <option key={opt.year} value={opt.year}>
              {opt.label}
            </option>
          ))}
        </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        aria-label="חודש קודם"
      >
        <Icon name="chevron_left" />
      </button>
    </div>
  );

  const showLessonLegend =
    compact ||
    Object.keys(countsByDate).length > 0 ||
    completeDates.length > 0 ||
    partialDates.length > 0;

  const legend = (
    <div className="mt-3 flex flex-wrap gap-3 font-caption text-caption text-on-surface-variant">
      {showLessonLegend && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
            יש שיעורים
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-attendance-present" />
            הושלם
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-attendance-late" />
            ממתין לרישום
          </span>
        </>
      )}
      {holidayDates.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-holiday-vacation" />
          חופשה
        </span>
      )}
      {cancelledDates.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-holiday-cancelled" />
          ביטול לימודים
        </span>
      )}
    </div>
  );

  return (
    <section
      className={cn(
        "rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md",
        compact ? "p-5" : "p-6"
      )}
    >
      {toolbar}
      <div className="mb-2 grid grid-cols-7 text-center font-label-md text-label-md text-on-surface-variant">
        {hebrewWeekdayLabels().map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {month.days.map((day, idx) => {
          if (!day.inMonth) {
            return <div key={`empty-${idx}`} className={compact ? "min-h-11" : "min-h-16"} />;
          }
          const count = countsByDate[day.iso] ?? 0;
          const selected = selectedDate === day.iso;
          const complete = completeSet.has(day.iso);
          const partial = !complete && partialSet.has(day.iso);
          const holiday = holidaySet.has(day.iso);
          const cancelled = cancelledSet.has(day.iso);
          const hasLessons = count > 0;
          const isToday = day.iso === today;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate?.(day.iso)}
              aria-label={`${formatGregorianDate(day.iso)}${hasLessons ? `, ${lessonCountLabel(count)}` : ""}${complete ? ", הושלם" : ""}${partial ? ", ממתין לרישום" : ""}${cancelled ? ", ביטול לימודים" : holiday ? ", חופשה" : ""}`}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl text-center transition-colors",
                compact ? "min-h-12 px-0.5 py-1" : "min-h-16 px-1 py-1.5",
                selected && "bg-primary-container font-semibold text-white shadow-tactile-sm",
                !selected && complete && "bg-[var(--day-completed)] text-attendance-present",
                !selected && partial && "bg-[var(--day-partial)] text-attendance-late",
                !selected &&
                  hasLessons &&
                  !complete &&
                  !partial &&
                  "bg-primary/10 text-primary hover:bg-primary/15",
                !selected &&
                  cancelled &&
                  !hasLessons &&
                  "bg-holiday-cancelled/80 text-primary hover:bg-holiday-cancelled",
                !selected &&
                  holiday &&
                  !cancelled &&
                  !hasLessons &&
                  "bg-holiday-vacation/80 text-on-secondary-container hover:bg-holiday-vacation",
                !selected &&
                  !hasLessons &&
                  !holiday &&
                  !cancelled &&
                  "text-on-surface hover:bg-surface-container",
                isToday && !selected && "ring-1 ring-inset ring-primary/50"
              )}
            >
              <span
                className={cn(
                  "leading-none",
                  compact ? "text-[9px]" : "font-caption text-caption",
                  selected ? "text-white/80" : "text-on-surface-variant"
                )}
              >
                {formatGregorianDayMonth(day.iso)}
              </span>
              <span className={cn("leading-none", compact ? "font-body-md text-body-md" : "font-title-lg text-title-lg")}>
                {day.label}
              </span>
              {hasLessons && (
                <span
                  className={cn(
                    "mt-0.5 leading-none",
                    compact ? "text-[9px]" : "font-caption text-caption",
                    selected
                      ? "text-white/90"
                      : complete
                        ? "text-attendance-present"
                        : partial
                          ? "text-attendance-late"
                          : "text-primary"
                  )}
                >
                  {compact
                    ? `${count} ש׳`
                    : complete
                      ? "הושלם"
                      : partial
                        ? "ממתין"
                        : lessonCountLabel(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {legend}
    </section>
  );
}
