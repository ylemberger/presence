"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  buildHebrewMonth,
  formatGregorianDate,
  hebrewMonthFromIso,
  hebrewWeekdayLabels,
  shiftHebrewMonth,
  todayIso,
} from "@/lib/dates/hebrew";

export interface HebrewMonthCalendarProps {
  initialMonthIso?: string;
  selectedDate?: string | null;
  /** number of lessons per date (for dot/badge) */
  countsByDate?: Record<string, number>;
  /** dates where all lessons that day are fully marked */
  completeDates?: string[];
  /** dates with lessons that are not fully marked yet */
  partialDates?: string[];
  onSelectDate: (iso: string) => void;
  onMonthRangeChange?: (rangeStart: string, rangeEnd: string) => void;
  /** Compact month grid used on the attendance screen. */
  compact?: boolean;
}

export function HebrewMonthCalendar({
  initialMonthIso,
  selectedDate,
  countsByDate = {},
  completeDates = [],
  partialDates = [],
  onSelectDate,
  onMonthRangeChange,
  compact = false,
}: HebrewMonthCalendarProps) {
  const seed = hebrewMonthFromIso(initialMonthIso || selectedDate || todayIso());
  const [cursor, setCursor] = useState(seed);
  const today = todayIso();

  useEffect(() => {
    if (initialMonthIso) {
      setCursor(hebrewMonthFromIso(initialMonthIso));
    }
  }, [initialMonthIso]);

  const month = useMemo(
    () => buildHebrewMonth(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  function navigate(delta: number) {
    const next = shiftHebrewMonth(cursor.year, cursor.month, delta);
    setCursor(next);
    const grid = buildHebrewMonth(next.year, next.month);
    onMonthRangeChange?.(grid.rangeStart, grid.rangeEnd);
  }

  if (compact) {
    return (
      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-tactile-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-title-lg text-title-lg text-primary">{month.title}</h3>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => navigate(1)}
              className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
              aria-label="חודש הבא"
            >
              <Icon name="chevron_right" />
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
              aria-label="חודש קודם"
            >
              <Icon name="chevron_left" />
            </button>
          </div>
        </div>
        <div className="mb-2 grid grid-cols-7 text-center font-label-md text-label-md text-on-surface-variant">
          {hebrewWeekdayLabels().map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center font-body-md text-body-md">
          {month.days.map((day, idx) => {
            if (!day.inMonth) {
              return <div key={`empty-${idx}`} className="p-2 text-outline-variant/50" />;
            }
            const count = countsByDate[day.iso] ?? 0;
            const selected = selectedDate === day.iso;
            const complete = completeDates.includes(day.iso);
            const partial = !complete && partialDates.includes(day.iso);
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => onSelectDate(day.iso)}
                className={cn(
                  "relative rounded-lg p-2 transition-colors",
                  selected
                    ? "bg-primary-container font-bold text-white shadow-tactile-sm"
                    : "text-on-surface hover:bg-surface-container"
                )}
              >
                {day.label}
                {!selected && complete && (
                  <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-attendance-present" />
                )}
                {!selected && partial && (
                  <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-attendance-late" />
                )}
                {selected && count > 0 && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] text-white/80">
                    {count} ש'
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 font-caption text-caption text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-attendance-present" />
            הושלם
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-attendance-late" />
            חלקי
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <Button variant="secondary" size="sm" type="button" onClick={() => navigate(-1)}>
          חודש קודם
        </Button>
        <h2 className="text-base font-semibold text-slate-800">{month.title}</h2>
        <Button variant="secondary" size="sm" type="button" onClick={() => navigate(1)}>
          חודש הבא
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-stone-100 px-4 py-2 text-[10px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
          יום שהושלם
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" aria-hidden />
          ממתין לרישום
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-300" aria-hidden />
          יש שיעורים
        </span>
      </div>

      <div className="grid grid-cols-7 gap-px bg-stone-100 p-px">
        {hebrewWeekdayLabels().map((d) => (
          <div
            key={d}
            className="bg-stone-50 px-1 py-2 text-center text-xs font-semibold text-slate-500"
          >
            {d}
          </div>
        ))}
        {month.days.map((day, idx) => {
          if (!day.inMonth) {
            return <div key={`empty-${idx}`} className="min-h-[4rem] bg-stone-50/50" />;
          }
          const count = countsByDate[day.iso] ?? 0;
          const selected = selectedDate === day.iso;
          const complete = completeDates.includes(day.iso);
          const partial = !complete && partialDates.includes(day.iso);
          const isToday = day.iso === today;
          const isPastPartial = partial && day.iso < today;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate(day.iso)}
              className={cn(
                "relative min-h-[4.25rem] p-1.5 text-right transition-colors",
                !complete && !partial && "bg-white hover:bg-stone-50",
                complete && !selected && "bg-[var(--day-completed)] hover:brightness-95",
                partial && !selected && !isPastPartial && "bg-[var(--day-partial)] hover:brightness-95",
                isPastPartial && !selected && "bg-[var(--day-partial)] hover:brightness-95",
                count > 0 && !selected && !complete && !partial && "bg-teal-50/50",
                selected && "ring-2 ring-inset ring-[var(--brand)]",
                selected && complete && "bg-emerald-50",
                selected && partial && "bg-amber-50",
                isToday && !selected && "outline outline-1 outline-offset-[-1px] outline-[var(--brand)]/40"
              )}
            >
              {complete && (
                <span
                  className="absolute left-1 top-1 h-2 w-2 rounded-full bg-emerald-500 shadow-sm"
                  aria-hidden
                />
              )}
              {isPastPartial && (
                <span
                  className="absolute left-1 top-1 h-2 w-2 rounded-full bg-amber-500 shadow-sm"
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "text-sm font-semibold",
                  complete ? "text-emerald-900" : partial ? "text-amber-950" : "text-slate-800"
                )}
              >
                {day.label}
              </div>
              <div className="text-[10px] text-slate-400">
                {formatGregorianDate(day.iso).slice(0, 5)}
              </div>
              {count > 0 && (
                <div
                  className={cn(
                    "mt-1 text-[10px] font-semibold",
                    complete
                      ? "text-emerald-700"
                      : partial
                        ? "text-amber-800"
                        : "text-[var(--brand)]"
                  )}
                >
                  {complete
                    ? "✓ הושלם"
                    : partial
                      ? "ממתין"
                      : `${count} שיעור${count > 1 ? "ים" : ""}`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
