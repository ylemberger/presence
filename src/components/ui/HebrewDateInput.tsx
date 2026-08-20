"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  daysInHebrewMonth,
  formatHebrewDate,
  hebrewMonthFromIso,
  hebrewMonthOptionsAround,
  hDateToIso,
  todayIso,
} from "@/lib/dates/hebrew";
import { HDate } from "@hebcal/core";

interface HebrewDateInputProps {
  label?: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (iso: string) => void;
  allowEmpty?: boolean;
  className?: string;
}

export function HebrewDateInput({
  label,
  name,
  required,
  defaultValue,
  value: controlled,
  onChange,
  allowEmpty,
  className,
}: HebrewDateInputProps) {
  const initial = controlled ?? defaultValue ?? (required && !allowEmpty ? todayIso() : "");
  const [iso, setIso] = useState(initial);

  const current = controlled ?? iso;
  const parts = current
    ? hebrewMonthFromIso(current)
    : hebrewMonthFromIso(todayIso());
  const day = current ? new HDate(parseIsoLocal(current)).getDate() : 0;

  const monthOptions = useMemo(
    () => hebrewMonthOptionsAround(current || todayIso()),
    [current]
  );

  function parseIsoLocal(v: string) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function update(nextIso: string) {
    setIso(nextIso);
    onChange?.(nextIso);
  }

  function setFromParts(year: number, month: number, dayNum: number) {
    const max = daysInHebrewMonth(year, month);
    const safeDay = Math.min(Math.max(dayNum || 1, 1), max);
    update(hDateToIso(new HDate(safeDay, month, year)));
  }

  const maxDay = daysInHebrewMonth(parts.year, parts.month);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700" htmlFor={`${name}-day`}>
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={current} required={required && !allowEmpty} />
      <div className="flex flex-wrap items-center gap-2">
        {allowEmpty && (
          <button
            type="button"
            className="rounded-lg border border-stone-200 px-2 py-2 text-xs text-slate-500 hover:bg-stone-50"
            onClick={() => update("")}
          >
            ריק
          </button>
        )}
        <select
          id={`${name}-day`}
          className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm"
          value={day || ""}
          disabled={!current && !!allowEmpty}
          onChange={(e) =>
            setFromParts(parts.year, parts.month, parseInt(e.target.value, 10))
          }
          required={required && !allowEmpty}
        >
          <option value="">{allowEmpty ? "יום" : "יום"}</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {new HDate(d, parts.month, parts.year).renderGematriya(true).split(" ")[0]}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm"
          value={`${parts.year}-${parts.month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setFromParts(y, m, day || 1);
          }}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {current && (
        <span className="text-xs text-slate-500">{formatHebrewDate(current)}</span>
      )}
    </div>
  );
}
