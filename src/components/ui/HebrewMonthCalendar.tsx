"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
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
}

export function HebrewMonthCalendar({
  initialMonthIso,
  selectedDate,
  countsByDate = {},
  completeDates = [],
  partialDates = [],
  onSelectDate,
  onMonthRangeChange,
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

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
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
                complete && !selected && "bg-emerald-100/90 hover:bg-emerald-100",
                partial && !selected && !isPastPartial && "bg-amber-50/90 hover:bg-amber-50",
                isPastPartial && !selected && "bg-amber-100 hover:bg-amber-100/90",
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
