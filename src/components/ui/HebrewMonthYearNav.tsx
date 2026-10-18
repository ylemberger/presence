"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  academicViewYear,
  buildHebrewMonth,
  formatGregorianRange,
  hebrewMonthOptionsForYear,
  hebrewYearLabel,
  hebrewYearOptions,
  schoolYearNote,
  todayIso,
} from "@/lib/dates/hebrew";

const selectClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-label-md text-label-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function HebrewMonthYearNav({
  year,
  month,
  onChange,
  compact = false,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  compact?: boolean;
}) {
  const grid = buildHebrewMonth(year, month);
  const viewYear = academicViewYear(year, month);
  const yearOptions = useMemo(() => hebrewYearOptions(todayIso(), 25), []);
  const monthOptions = useMemo(() => hebrewMonthOptionsForYear(viewYear), [viewYear]);
  const elul = month === 6;

  function pickMonth(value: string) {
    const [y, m] = value.split("-").map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) onChange(y, m);
  }

  function pickYear(value: string) {
    const nextYear = Number(value);
    const months = hebrewMonthOptionsForYear(nextYear);
    const match =
      months.find((item) => item.month === month) ??
      months.find((item) => item.month === 7) ??
      months[0];
    if (match) onChange(match.year, match.month);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <p className={cn("font-bold text-primary", compact ? "font-title-lg text-title-lg" : "font-headline-md text-headline-md")}>
        {grid.title}
      </p>
      <p
        className={cn(
          "max-w-md font-body-sm text-body-sm",
          elul ? "text-primary" : "text-on-surface-variant"
        )}
      >
        {schoolYearNote(year, month)}
      </p>
      {!compact && (
        <p className="font-caption text-caption text-on-surface-variant">
          לועזי לבדיקה: {formatGregorianRange(grid.rangeStart, grid.rangeEnd)}
        </p>
      )}
      <div className={cn("flex flex-wrap items-end justify-center gap-3", compact ? "w-full" : "w-full max-w-xl")}>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-right">
          <span className="font-label-md text-label-md text-primary">חודש</span>
          <select
            className={selectClass}
            aria-label="חודש עברי"
            value={`${year}-${month}`}
            onChange={(e) => pickMonth(e.target.value)}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1 text-right">
          <span className="font-label-md text-label-md text-primary">שנת לימודים</span>
          <select
            className={selectClass}
            aria-label="שנת לימודים"
            value={viewYear}
            onChange={(e) => pickYear(e.target.value)}
          >
            {yearOptions.map((opt) => (
              <option key={opt.year} value={opt.year}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!compact && (
        <p className="font-caption text-caption text-on-surface-variant">
          שנת {hebrewYearLabel(viewYear)}: אלול {hebrewYearLabel(viewYear - 1)} ואז תשרי עד אב {hebrewYearLabel(viewYear)}.
        </p>
      )}
    </div>
  );
}
