"use client";

import { useMemo } from "react";
import { hebrewWeekdayLabels } from "@/lib/dates/hebrew";
import { cn } from "@/lib/cn";

export type TimetableBillingType = "mandatory" | "specialization";

export interface TimetableEntry {
  lessonId: string;
  subject: string;
  teacherName?: string;
  teacherId?: string | null;
  dayOfWeek: number; // 0-6 (ראשון-שבת)
  lessonNumber: number; // 1-9
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
      if (e.lessonNumber < 1 || e.lessonNumber > maxLessonNumber) continue;
      const key = `${e.dayOfWeek}::${e.lessonNumber}`;
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return m;
  }, [entries, maxLessonNumber]);

  function cellClasses(e?: TimetableEntry) {
    if (!e) return "bg-white";
    const base =
      e.billingType === "specialization"
        ? "bg-[var(--accent-soft)]"
        : "bg-stone-50";

    const psych = e.forPsychology ? "ring-2 ring-indigo-200" : "";
    return cn(base, "rounded-lg border border-stone-200/70 px-2 py-1", psych);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="bg-stone-50">
            <th className="w-[4.5rem] border-b border-stone-200/80 px-2 py-3 text-center text-xs font-semibold text-slate-600">
              שעה
            </th>
            {days.map((d) => (
              <th
                key={d}
                className="border-b border-stone-200/80 px-2 py-3 text-center text-xs font-semibold text-slate-600"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxLessonNumber }, (_, i) => i + 1).map((lessonNo) => (
            <tr key={lessonNo} className="odd:bg-white even:bg-stone-50/20">
              <td className="w-[4.5rem] border-b border-stone-200/70 px-2 py-2 text-center font-semibold text-slate-600">
                {lessonNo}
              </td>
              {days.map((_, dayIdx) => {
                const slotKey = `${dayIdx}::${lessonNo}`;
                const slotEntries = bySlot.get(slotKey) ?? [];
                const first = slotEntries[0];
                return (
                  <td
                    key={slotKey}
                    className="border-b border-stone-200/70 px-2 py-2 align-top text-right"
                  >
                    {slotEntries.length === 0 ? (
                      <div className="text-xs text-slate-300">—</div>
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
                                isClickable ? "hover:brightness-95" : "cursor-default"
                              )}
                              title={e.audienceLabel ?? e.subject}
                            >
                              <div className={cellClasses(e)}>
                                <div className="truncate font-semibold leading-tight text-slate-800">
                                  {e.subject}
                                </div>
                                {(e.teacherName || e.audienceLabel) && (
                                  <div className="mt-0.5 truncate text-[10px] leading-tight text-slate-600">
                                    {e.teacherName ?? ""}{e.teacherName && e.audienceLabel ? " · " : ""}
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

