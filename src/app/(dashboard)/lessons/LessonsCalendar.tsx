"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildHebrewMonth,
  formatHebrewDate,
  hebrewMonthFromIso,
  hebrewMonthOptionsForYear,
  hebrewWeekdayLabels,
  hebrewYearOptions,
  shiftHebrewMonth,
  todayIso,
} from "@/lib/dates/hebrew";
import { OCCURRENCE_STATUS_LABELS } from "@/lib/constants";
import { formatLessonHours } from "@/lib/lessons/hours";
import { cn } from "@/lib/cn";
import { completeOccurrenceAction } from "../actions";
import type { Lesson } from "@/types/database";
import { Icon } from "@/components/ui/Icon";

interface OccurrenceRow {
  id: string;
  occurrence_date: string;
  status: string;
  notes: string | null;
  lesson_id: string;
  subject: string;
}

interface LessonsCalendarProps {
  initialMonthIso?: string;
  occurrences: OccurrenceRow[];
  lessons: Lesson[];
  monthQuery: string;
  holidayDates?: string[];
}

const STATUS_META: Record<string, { pillClass: string; icon: string; label: string }> = {
  completed: {
    pillClass: "bg-attendance-present/10 text-attendance-present",
    icon: "check_circle",
    label: "הושלם",
  },
  scheduled: {
    pillClass: "bg-surface-container text-on-surface",
    icon: "schedule",
    label: "מתוכנן",
  },
};

export function LessonsCalendar({
  initialMonthIso,
  occurrences,
  lessons,
  monthQuery,
  holidayDates = [],
}: LessonsCalendarProps) {
  const router = useRouter();
  const seed = hebrewMonthFromIso(initialMonthIso || todayIso());
  const [cursor, setCursor] = useState(seed);
  const [selectedIso, setSelectedIso] = useState<string | null>(todayIso());

  const month = useMemo(
    () => buildHebrewMonth(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, OccurrenceRow[]>();
    for (const o of occurrences) {
      const list = map.get(o.occurrence_date) ?? [];
      list.push(o);
      map.set(o.occurrence_date, list);
    }
    return map;
  }, [occurrences]);

  const selectedOccurrences = selectedIso ? byDate.get(selectedIso) ?? [] : [];
  const todayStr = todayIso();
  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates]);

  const yearOptions = useMemo(() => hebrewYearOptions(todayStr, 25), [todayStr]);
  const monthOptions = useMemo(
    () => hebrewMonthOptionsForYear(cursor.year),
    [cursor.year]
  );

  function goTo(year: number, monthNum: number) {
    const next = { year, month: monthNum };
    setCursor(next);
    const grid = buildHebrewMonth(year, monthNum);
    const params = new URLSearchParams(monthQuery);
    params.set("from", grid.rangeStart);
    params.set("to", grid.rangeEnd);
    router.push(`/lessons?${params.toString()}`);
  }

  function navigate(delta: number) {
    const next = shiftHebrewMonth(cursor.year, cursor.month, delta);
    goTo(next.year, next.month);
  }

  async function markComplete(id: string) {
    await completeOccurrenceAction(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-gutter lg:flex-row">
      <section className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack_md shadow-tactile-md lg:w-2/5">
        <div className="mb-stack_md flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="חודש הבא"
          >
            <Icon name="chevron_right" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <select
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-label-md text-label-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-label-md text-label-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="חודש קודם"
          >
            <Icon name="chevron_left" />
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center font-label-md text-label-md text-on-surface-variant">
          {hebrewWeekdayLabels().map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-body-md text-body-md">
          {month.days.map((day, idx) => {
            if (!day.inMonth) {
              return <div key={`empty-${idx}`} className="p-2 text-surface-dim" />;
            }
            const dayOcc = byDate.get(day.iso) ?? [];
            const selected = selectedIso === day.iso;
            const isToday = day.iso === todayStr;
            const hasEvents = dayOcc.length > 0;
            const holiday = holidaySet.has(day.iso);
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedIso(day.iso)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl p-1 transition-colors",
                  selected
                    ? "bg-primary-container font-bold text-white shadow-tactile-sm"
                    : holiday
                      ? "bg-secondary-container/70 text-on-secondary-container"
                      : hasEvents
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : isToday
                          ? "ring-1 ring-inset ring-secondary text-primary"
                          : "text-on-surface hover:bg-surface-container"
                )}
                aria-label={
                  holiday
                    ? `${day.iso} חופשה`
                    : hasEvents
                      ? `${day.iso}, ${dayOcc.length} שיעורים`
                      : day.iso
                }
              >
                <span>{day.label}</span>
                {hasEvents && (
                  <span
                    className={cn(
                      "text-[9px] leading-none",
                      selected ? "text-white/90" : "text-primary"
                    )}
                  >
                    {dayOcc.length} ש׳
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 font-caption text-caption text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
            יש שיעורים
          </span>
          {holidayDates.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-secondary-container" />
              חופשה
            </span>
          )}
        </div>
      </section>

      <div className="flex w-full flex-col gap-gutter lg:w-3/5">
        <section className="flex min-h-[500px] flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack_md shadow-tactile-md">
          <div className="mb-stack_md flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
            <h3 className="font-title-lg text-title-lg text-primary">
              {selectedIso ? formatHebrewDate(selectedIso) : "בחרי יום"}
            </h3>
            <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-md text-label-md text-on-surface-variant">
              {selectedOccurrences.length} שיעורים
            </span>
          </div>

          {selectedIso && selectedOccurrences.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
              <Icon
                name={holidaySet.has(selectedIso) ? "event_busy" : "event_available"}
                className="mb-2 text-[36px] text-secondary"
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {holidaySet.has(selectedIso)
                  ? "יום חופשה — אין לימודים ולא נספרת נוכחות."
                  : "אין שיעורים ביום זה."}
              </p>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pl-2">
            {selectedOccurrences.map((o, idx) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.scheduled;
              const label =
                OCCURRENCE_STATUS_LABELS[o.status as keyof typeof OCCURRENCE_STATUS_LABELS] ??
                o.status;

              return (
                <div
                  key={o.id}
                  className={cn(
                    "group flex flex-col gap-4 rounded-lg border border-outline-variant p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    o.status === "scheduled"
                      ? "border-l-4 border-l-secondary bg-surface-container-lowest shadow-tactile-sm hover:border-primary-fixed-dim"
                      : "bg-surface-container-lowest hover:border-primary-fixed-dim"
                  )}
                >
                  <div className="flex items-start gap-4 sm:items-center">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high">
                      <span className="font-label-md text-label-md text-on-surface">שיעור</span>
                      <span className="font-headline-md text-headline-md leading-none text-primary">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="flex flex-wrap items-center gap-2 font-title-lg text-title-lg text-on-surface">
                        {o.subject || "ללא שם"}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-caption text-caption",
                            meta.pillClass
                          )}
                        >
                          <Icon name={meta.icon} className="text-[14px]" />
                          {meta.label ?? label}
                        </span>
                      </h4>
                      {o.notes && (
                        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                          <Icon name="info" className="ml-1 align-middle text-[16px]" />
                          {o.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {o.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => markComplete(o.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-container px-3 py-1.5 font-label-md text-label-md text-white transition-colors hover:bg-primary hover:text-white"
                    >
                      <Icon name="done_all" className="text-[18px]" />
                      השלמה
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack_md shadow-tactile-md">
          <h3 className="mb-3 flex items-center gap-2 font-title-lg text-title-lg text-primary">
            <Icon name="view_agenda" className="text-secondary" />
            תבניות שיעור
          </h3>
          {lessons.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              אין תבניות לפי הסינון. הוסיפי שיעור חדש בטופס.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 font-body-md text-body-md">
              {lessons.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 transition-colors hover:border-secondary/40"
                >
                  <span className="font-semibold text-on-surface">{l.subject}</span>
                  <span className="font-caption text-caption text-on-surface-variant">
                    {formatLessonHours(l.lesson_number, l.period_count ?? 1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
