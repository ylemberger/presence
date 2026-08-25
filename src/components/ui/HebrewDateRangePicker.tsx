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
  parseFlexibleDate,
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
  /** First click selects a single day; second click expands to a range. */
  singleClickSelectsDay?: boolean;
}

export function HebrewDateRangePicker({
  startName,
  endName,
  defaultStart,
  defaultEnd,
  required,
  className,
  singleClickSelectsDay = false,
}: HebrewDateRangePickerProps) {
  const seedIso = defaultStart || defaultEnd || todayIso();
  const [cursor, setCursor] = useState(() => hebrewMonthFromIso(seedIso));
  const [start, setStart] = useState(defaultStart ?? "");
  const [end, setEnd] = useState(defaultEnd ?? "");
  const [startQuery, setStartQuery] = useState(defaultStart ? formatHebrewDate(defaultStart) : "");
  const [endQuery, setEndQuery] = useState(defaultEnd ? formatHebrewDate(defaultEnd) : "");
  const [startInvalid, setStartInvalid] = useState(false);
  const [endInvalid, setEndInvalid] = useState(false);
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

  function commitStart(iso: string) {
    setStart(iso);
    setStartQuery(iso ? formatHebrewDate(iso) : "");
    setStartInvalid(false);
    if (iso) setCursor(hebrewMonthFromIso(iso));
  }

  function commitEnd(iso: string) {
    setEnd(iso);
    setEndQuery(iso ? formatHebrewDate(iso) : "");
    setEndInvalid(false);
    if (iso) setCursor(hebrewMonthFromIso(iso));
  }

  function tryCommit(raw: string, which: "start" | "end") {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (which === "start") {
        commitStart("");
        setEnd("");
        setEndQuery("");
      } else {
        commitEnd("");
      }
      return;
    }
    const parsed = parseFlexibleDate(trimmed, start || end || todayIso());
    if (!parsed) {
      if (which === "start") setStartInvalid(true);
      else setEndInvalid(true);
      return;
    }
    if (which === "start") {
      commitStart(parsed);
      if (end && parsed > end) commitEnd("");
    } else if (start && parsed < start) {
      commitEnd(start);
      commitStart(parsed);
    } else {
      commitEnd(parsed);
    }
  }

  function handleDayClick(iso: string) {
    if (singleClickSelectsDay) {
      if (!start) {
        commitStart(iso);
        commitEnd(iso);
        return;
      }
      if (start === end) {
        if (iso === start) return;
        if (iso < start) {
          commitEnd(start);
          commitStart(iso);
          return;
        }
        commitEnd(iso);
        return;
      }
      commitStart(iso);
      commitEnd(iso);
      return;
    }
    if (!start || (start && end)) {
      commitStart(iso);
      commitEnd("");
      return;
    }
    if (iso < start) {
      commitEnd(start);
      commitStart(iso);
      return;
    }
    commitEnd(iso);
  }

  function clearRange() {
    commitStart("");
    commitEnd("");
    setHoverIso(null);
  }

  return (
    <div className={cn("w-full min-w-[20rem] space-y-3", className)}>
      <input type="hidden" name={startName} value={start} required={required} />
      <input type="hidden" name={endName} value={end} required={required} />

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface">מתאריך</span>
          <input
            type="text"
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]",
              startInvalid ? "border-error" : "border-stone-200"
            )}
            placeholder="כתבי תאריך או בחרי ביומן…"
            value={startQuery}
            onChange={(e) => {
              setStartQuery(e.target.value);
              setStartInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryCommit(startQuery, "start");
              }
            }}
            onBlur={() => {
              if (startQuery.trim() !== (start ? formatHebrewDate(start) : "")) {
                tryCommit(startQuery, "start");
              }
            }}
          />
          {startInvalid && (
            <span className="font-caption text-caption text-error">לא זוהה תאריך התחלה</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface">עד תאריך</span>
          <input
            type="text"
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]",
              endInvalid ? "border-error" : "border-stone-200"
            )}
            placeholder="כתבי תאריך או בחרי ביומן…"
            value={endQuery}
            onChange={(e) => {
              setEndQuery(e.target.value);
              setEndInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryCommit(endQuery, "end");
              }
            }}
            onBlur={() => {
              if (endQuery.trim() !== (end ? formatHebrewDate(end) : "")) {
                tryCommit(endQuery, "end");
              }
            }}
          />
          {endInvalid && (
            <span className="font-caption text-caption text-error">לא זוהה תאריך סיום</span>
          )}
        </label>
      </div>

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
            <p className="text-slate-500">
              {singleClickSelectsDay
                ? "לחצי על תאריך ליום אחד, ואפשר להרחיב בלחיצה על תאריך נוסף"
                : "כתבי תאריך בשדות למעלה, או לחצי על תאריך התחלה ואחר כך על תאריך סיום. ליום אחד — לחצי פעמיים על אותו תאריך"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {start && !end && (
            <Button variant="secondary" size="sm" type="button" onClick={() => commitEnd(start)}>
              יום אחד בלבד
            </Button>
          )}
          {(start || end) && (
            <Button variant="secondary" size="sm" type="button" onClick={clearRange}>
              ניקוי
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
