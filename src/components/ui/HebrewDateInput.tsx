"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  buildHebrewMonth,
  daysInHebrewMonth,
  formatGregorianDate,
  formatHebrewDate,
  hebrewMonthFromIso,
  hebrewMonthOptionsAround,
  hebrewWeekdayLabels,
  hDateToIso,
  isoToHDate,
  parseFlexibleDate,
  shiftHebrewMonth,
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
  const [query, setQuery] = useState(initial ? formatHebrewDate(initial) : "");
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = controlled ?? iso;
  const parts = hebrewMonthFromIso(current || todayIso());
  const month = useMemo(
    () => buildHebrewMonth(parts.year, parts.month),
    [parts.year, parts.month]
  );
  const monthOptions = useMemo(
    () => hebrewMonthOptionsAround(current || todayIso()),
    [current]
  );

  useEffect(() => {
    if (controlled !== undefined) {
      setQuery(controlled ? formatHebrewDate(controlled) : "");
    }
  }, [controlled]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commitIso(next: string) {
    setIso(next);
    setQuery(next ? formatHebrewDate(next) : "");
    setInvalid(false);
    onChange?.(next);
  }

  function tryCommitQuery(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (allowEmpty) {
        commitIso("");
        return;
      }
      setInvalid(true);
      return;
    }
    const parsed = parseFlexibleDate(trimmed, current || todayIso());
    if (!parsed) {
      setInvalid(true);
      return;
    }
    commitIso(parsed);
    setOpen(false);
  }

  function setFromMonth(year: number, monthNum: number) {
    const day = current ? isoToHDate(current).getDate() : 1;
    const max = daysInHebrewMonth(year, monthNum);
    commitIso(hDateToIso(new HDate(Math.min(day, max), monthNum, year)));
  }

  const fieldClass =
    "w-full rounded-lg border bg-surface-container-lowest px-3.5 py-2.5 pe-10 text-body-md text-on-surface shadow-tactile-sm transition-colors placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={`${name}-text`} className="block font-label-md text-label-md text-on-surface">
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={current} required={required && !allowEmpty} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative min-w-0 flex-1">
          <input
            id={`${name}-text`}
            type="text"
            autoComplete="off"
            className={cn(
              fieldClass,
              invalid ? "border-error focus:ring-error" : "border-outline-variant"
            )}
            placeholder="כתבי תאריך או בחרי ביומן…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setInvalid(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryCommitQuery(query);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            onBlur={() => {
              if (query.trim() !== (current ? formatHebrewDate(current) : "")) {
                tryCommitQuery(query);
              }
            }}
          />
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-primary"
            aria-label="פתחי יומן"
            aria-expanded={open}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="calendar_month" className="text-[18px]" />
          </button>
        </div>
        <select
          className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface shadow-tactile-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="חודש עברי"
          value={`${parts.year}-${parts.month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setFromMonth(y, m);
            setOpen(true);
          }}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {open && (
        <div
          className="z-40 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-tactile-lg sm:absolute sm:start-0 sm:top-full sm:mt-1 sm:w-[min(100%,22rem)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between border-b border-outline-variant/30 px-2 py-2">
            <button
              type="button"
              className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
              aria-label="חודש הבא"
              onClick={() => {
                const next = shiftHebrewMonth(parts.year, parts.month, 1);
                setFromMonth(next.year, next.month);
              }}
            >
              <Icon name="chevron_right" />
            </button>
            <span className="font-label-md text-label-md text-primary">{month.title}</span>
            <button
              type="button"
              className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
              aria-label="חודש קודם"
              onClick={() => {
                const next = shiftHebrewMonth(parts.year, parts.month, -1);
                setFromMonth(next.year, next.month);
              }}
            >
              <Icon name="chevron_left" />
            </button>
          </div>
          <div className="grid grid-cols-7 px-2 pt-2 text-center font-caption text-caption text-on-surface-variant">
            {hebrewWeekdayLabels().map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 p-2">
            {month.days.map((day, idx) =>
              day.inMonth ? (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    commitIso(day.iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg py-1.5 text-center font-body-sm text-body-sm transition-colors",
                    day.iso === current
                      ? "bg-primary-container font-semibold text-white"
                      : day.iso === todayIso()
                        ? "bg-secondary-container/60 text-primary hover:bg-secondary-container"
                        : "text-on-surface hover:bg-surface-container"
                  )}
                >
                  {day.label}
                </button>
              ) : (
                <div key={`e-${idx}`} />
              )
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {allowEmpty && (
          <button
            type="button"
            className="font-caption text-caption text-on-surface-variant hover:text-primary"
            onClick={() => commitIso("")}
          >
            ריק
          </button>
        )}
        {current && !invalid && (
          <span className="font-caption text-caption text-on-surface-variant">
            {formatHebrewDate(current)} · {formatGregorianDate(current)}
          </span>
        )}
        {invalid && (
          <span className="font-caption text-caption text-error">
            לא זוהה תאריך. נסי 15.8.2026 או ט״ו אלול, או בחרי ביומן.
          </span>
        )}
      </div>
    </div>
  );
}
