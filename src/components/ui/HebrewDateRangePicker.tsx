"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  buildHebrewMonth,
  formatDatePair,
  formatGregorianDate,
  formatHebrewDate,
  hebrewMonthFromIso,
  hebrewMonthOptionsForYear,
  hebrewWeekdayLabels,
  hebrewYearOptions,
  isIsoInRange,
  shiftHebrewMonth,
  todayIso,
} from "@/lib/dates/hebrew";

interface HebrewDateRangePickerProps {
  startName: string;
  endName: string;
  defaultStart?: string;
  defaultEnd?: string;
  required?: boolean;
  className?: string;
}

export function HebrewDateRangePicker({
  startName,
  endName,
  defaultStart,
  defaultEnd,
  required,
  className,
}: HebrewDateRangePickerProps) {
  const seedIso = defaultStart || defaultEnd || todayIso();
  const [cursor, setCursor] = useState(() => hebrewMonthFromIso(seedIso));
  const [start, setStart] = useState(defaultStart ?? "");
  const [end, setEnd] = useState(defaultEnd ?? "");
  const [hoverIso, setHoverIso] = useState<string | null>(null);

  const month = useMemo(
    () => buildHebrewMonth(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const yearOptions = useMemo(
    () => hebrewYearOptions(seedIso, 25),
    [seedIso]
  );

  const monthOptions = useMemo(
    () => hebrewMonthOptionsForYear(cursor.year),
    [cursor.year]
  );

  const previewEnd = end || (start && hoverIso ? hoverIso : "");

  function handleDayClick(iso: string) {
    if (!start || (start && end)) {
      setStart(iso);
      setEnd("");
      return;
    }
    if (iso < start) {
      setEnd(start);
      setStart(iso);
      return;
    }
    setEnd(iso);
  }

  function clearRange() {
    setStart("");
    setEnd("");
    setHoverIso(null);
  }

  return (
    <div className={cn("w-full min-w-[20rem] space-y-3", className)}>
      <input type="hidden" name={startName} value={start} required={required} />
      <input type="hidden" name={endName} value={end} required={required} />

      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setCursor((c) => shiftHebrewMonth(c.year, c.month, -1))}
          >
            חודש קודם
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <select
              className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm"
              value={cursor.month}
              aria-label="חודש עברי"
              onChange={(e) =>
                setCursor((c) => ({ ...c, month: parseInt(e.target.value, 10) }))
              }
            >
              {monthOptions.map((opt) => (
                <option key={opt.month} value={opt.month}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm"
              value={cursor.year}
              aria-label="שנה עברית"
              onChange={(e) => {
                const year = parseInt(e.target.value, 10);
                const months = hebrewMonthOptionsForYear(year);
                setCursor({ year, month: months[0]?.month ?? 1 });
              }}
            >
              {yearOptions.map((opt) => (
                <option key={opt.year} value={opt.year}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setCursor((c) => shiftHebrewMonth(c.year, c.month, 1))}
          >
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
              return <div key={`empty-${idx}`} className="min-h-[3.25rem] bg-stone-50/50" />;
            }

            const inRange =
              start &&
              previewEnd &&
              isIsoInRange(day.iso, start, previewEnd);
            const isStart = day.iso === start;
            const isEnd = day.iso === (end || (hoverIso && !end ? hoverIso : ""));
            const selected = isStart || isEnd;

            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => handleDayClick(day.iso)}
                onMouseEnter={() => start && !end && setHoverIso(day.iso)}
                onMouseLeave={() => setHoverIso(null)}
                className={cn(
                  "min-h-[3.25rem] bg-white p-1.5 text-right transition-colors hover:bg-stone-50",
                  inRange && "bg-[var(--brand)]/10",
                  selected && "ring-2 ring-inset ring-[var(--brand)]",
                  isStart && "rounded-r-lg",
                  isEnd && "rounded-l-lg"
                )}
              >
                <div className="text-sm font-semibold text-slate-800">{day.label}</div>
                <div className="text-[10px] text-slate-400">
                  {formatGregorianDate(day.iso).slice(0, 5)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-slate-700">טווח נבחר</p>
          {start ? (
            <div className="text-slate-600">
              <span>
                מתאריך: {formatHebrewDate(start)} ({formatDatePair(start).gregorian})
              </span>
              {end && (
                <>
                  <span className="mx-2 text-slate-300">→</span>
                  <span>
                    עד: {formatHebrewDate(end)} ({formatDatePair(end).gregorian})
                  </span>
                </>
              )}
              {start && !end && (
                <span className="mr-2 text-slate-400"> — בחרי תאריך סיום</span>
              )}
            </div>
          ) : (
            <p className="text-slate-500">לחצי על תאריך התחלה, ואחר כך על תאריך סיום</p>
          )}
        </div>
        {(start || end) && (
          <Button variant="secondary" size="sm" type="button" onClick={clearRange}>
            ניקוי
          </Button>
        )}
      </div>
    </div>
  );
}
