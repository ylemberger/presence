"use client";

import { useMemo } from "react";
import { hebrewWeekdayLabels } from "@/lib/dates/hebrew";
import { formatLessonHours, occupiedLessonNumbers } from "@/lib/lessons/hours";
import { cn } from "@/lib/cn";

export type TimetableBillingType = "mandatory" | "specialization";

export interface TimetableEntry {
  lessonId: string;
  subject: string;
  teacherName?: string;
  teacherId?: string | null;
  dayOfWeek: number; // 0-6 (ראשון-שבת)
  lessonNumber: number; // 1-9
  periodCount?: number;
  billingType: TimetableBillingType;
  forPsychology?: boolean;
  audienceLabel?: string;
}

export function WeeklyTimetableGrid({
  entries,
  maxLessonNumber = 9,
  onCellClick,
}: {
  entries: TimetableEntry[];
  maxLessonNumber?: number;
  onCellClick?: (entry: TimetableEntry) => void;
}) {
  const days = hebrewWeekdayLabels();

  const bySlot = useMemo(() => {
    const m = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      if (e.dayOfWeek < 0 || e.dayOfWeek > 6) continue;
      const hours = occupiedLessonNumbers(e.lessonNumber, e.periodCount ?? 1);
      for (const hour of hours) {
        if (hour < 1 || hour > maxLessonNumber) continue;
        const key = `${e.dayOfWeek}::${hour}`;
        m.set(key, [...(m.get(key) ?? []), e]);
      }
    }
    return m;
  }, [entries, maxLessonNumber]);

  function cellClasses(e?: TimetableEntry) {
    if (!e) return "bg-surface-container-lowest";
    const base =
      e.billingType === "specialization"
        ? "bg-secondary-container/40"
        : "bg-surface-container-low";

    const psych = e.forPsychology ? "ring-2 ring-primary-fixed-dim" : "";
    return cn(
      base,
      "rounded-lg border border-outline-variant/40 px-2 py-1.5 transition-colors",
      psych
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <table className="w-full table-fixed border-collapse font-body-md text-body-md">
        <thead>
          <tr className="bg-surface-container-low">
            <th className="w-[4.5rem] border-b border-outline-variant/30 px-2 py-3 text-center font-label-md text-label-md text-on-surface-variant">
              שעה
            </th>
            {days.map((d) => (
              <th
                key={d}
                className="border-b border-outline-variant/30 px-2 py-3 text-center font-label-md text-label-md text-on-surface-variant"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxLessonNumber }, (_, i) => i + 1).map((lessonNo) => (
            <tr
              key={lessonNo}
              className="odd:bg-surface-container-lowest even:bg-surface-container-low/30"
            >
              <td className="w-[4.5rem] border-b border-outline-variant/25 px-2 py-2 text-center font-label-md text-label-md text-primary">
                {lessonNo}
              </td>
              {days.map((_, dayIdx) => {
                const slotKey = `${dayIdx}::${lessonNo}`;
                const slotEntries = bySlot.get(slotKey) ?? [];
                return (
                  <td
                    key={slotKey}
                    className="border-b border-outline-variant/25 px-2 py-2 align-top text-right"
                  >
                    {slotEntries.length === 0 ? (
                      <div className="font-caption text-caption text-outline-variant">
                        —
                      </div>
                    ) : (
                      <div className="flex max-h-[9.5rem] flex-col gap-1 overflow-auto">
                        {slotEntries.map((e, idx) => {
                          const isClickable = Boolean(onCellClick);
                          return (
                            <button
                              key={`${e.lessonId}-${idx}`}
                              type="button"
                              disabled={!isClickable}
                              onClick={() => onCellClick?.(e)}
                              className={cn(
                                "text-right",
                                isClickable
                                  ? "hover:brightness-95"
                                  : "cursor-default"
                              )}
                              title={e.audienceLabel ?? e.subject}
                            >
                              <div className={cellClasses(e)}>
                                <div className="truncate font-label-md text-label-md leading-tight text-primary">
                                  {e.subject}
                                </div>
                                {(e.periodCount ?? 1) > 1 && (
                                  <div className="font-caption text-caption leading-tight text-primary">
                                    {formatLessonHours(e.lessonNumber, e.periodCount)}
                                  </div>
                                )}
                                {(e.teacherName || e.audienceLabel) && (
                                  <div className="mt-0.5 truncate font-caption text-caption leading-tight text-on-surface-variant">
                                    {e.teacherName ?? ""}
                                    {e.teacherName && e.audienceLabel ? " · " : ""}
                                    {e.audienceLabel ?? ""}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

