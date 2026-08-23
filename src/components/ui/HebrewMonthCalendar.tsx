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
  onSelectDate: (iso: string) => void;
  onMonthRangeChange?: (rangeStart: string, rangeEnd: string) => void;
}

export function HebrewMonthCalendar({
  initialMonthIso,
  selectedDate,
  countsByDate = {},
  onSelectDate,
  onMonthRangeChange,
}: HebrewMonthCalendarProps) {
  const seed = hebrewMonthFromIso(initialMonthIso || selectedDate || todayIso());
  const [cursor, setCursor] = useState(seed);

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
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate(day.iso)}
              className={cn(
                "min-h-[4rem] bg-white p-1.5 text-right transition-colors hover:bg-stone-50",
                selected && "ring-2 ring-inset ring-[var(--brand)] bg-[var(--brand)]/5",
                count > 0 && !selected && "bg-teal-50/40"
              )}
            >
              <div className="text-sm font-semibold text-slate-800">{day.label}</div>
              <div className="text-[10px] text-slate-400">{formatGregorianDate(day.iso).slice(0, 5)}</div>
              {count > 0 && (
                <div className="mt-1 text-[10px] font-medium text-[var(--brand)]">
                  {count} שיעור{count > 1 ? "ים" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
