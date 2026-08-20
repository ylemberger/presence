"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LessonsForm } from "./LessonsForm";
import {
  buildHebrewMonth,
  formatHebrewDate,
  hebrewMonthFromIso,
  hebrewWeekdayLabels,
  shiftHebrewMonth,
  todayIso,
} from "@/lib/dates/hebrew";
import { OCCURRENCE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import {
  cancelOccurrenceAction,
  completeOccurrenceAction,
  restoreOccurrenceAction,
} from "../actions";
import type {
  Grade,
  Class,
  Track,
  Specialization,
  ActivityRange,
  AttendanceRule,
  Lesson,
} from "@/types/database";

interface OccurrenceRow {
  id: string;
  occurrence_date: string;
  status: string;
  notes: string | null;
  lesson_id: string;
  subject: string;
}

interface LessonsCalendarProps {
  yearId: string;
  initialMonthIso?: string;
  occurrences: OccurrenceRow[];
  lessons: Lesson[];
  teachingAssignments: Array<{ id: string; subject: string; teachers: { full_name: string } }>;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  ranges: ActivityRange[];
  rules: AttendanceRule[];
}

export function LessonsCalendar({
  yearId,
  initialMonthIso,
  occurrences,
  lessons,
  teachingAssignments,
  grades,
  classes,
  tracks,
  specializations,
  ranges,
  rules,
}: LessonsCalendarProps) {
  const router = useRouter();
  const seed = hebrewMonthFromIso(initialMonthIso || todayIso());
  const [cursor, setCursor] = useState(seed);
  const [selectedIso, setSelectedIso] = useState<string | null>(todayIso());
  const [creating, setCreating] = useState(false);

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

  function navigate(delta: number) {
    const next = shiftHebrewMonth(cursor.year, cursor.month, delta);
    setCursor(next);
    const grid = buildHebrewMonth(next.year, next.month);
    router.push(`/lessons?from=${grid.rangeStart}&to=${grid.rangeEnd}`);
  }

  async function setStatus(id: string, action: "cancel" | "complete" | "restore") {
    if (action === "cancel") await cancelOccurrenceAction(id);
    if (action === "complete") await completeOccurrenceAction(id);
    if (action === "restore") await restoreOccurrenceAction(id);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <Button variant="secondary" size="sm" type="button" onClick={() => navigate(-1)}>
            חודש קודם
          </Button>
          <h2 className="text-lg font-semibold text-slate-800">{month.title}</h2>
          <Button variant="secondary" size="sm" type="button" onClick={() => navigate(1)}>
            חודש הבא
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-stone-100 p-px">
          {hebrewWeekdayLabels().map((d) => (
            <div key={d} className="bg-stone-50 px-2 py-2 text-center text-xs font-semibold text-slate-500">
              {d}
            </div>
          ))}
          {month.days.map((day, idx) => {
            if (!day.inMonth) {
              return <div key={`empty-${idx}`} className="min-h-[5.5rem] bg-stone-50/50" />;
            }
            const dayOcc = byDate.get(day.iso) ?? [];
            const selected = selectedIso === day.iso;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => {
                  setSelectedIso(day.iso);
                  setCreating(false);
                }}
                className={cn(
                  "min-h-[5.5rem] bg-white p-2 text-right transition-colors hover:bg-stone-50",
                  selected && "ring-2 ring-inset ring-[var(--brand)]"
                )}
              >
                <div className="text-sm font-semibold text-slate-800">{day.label}</div>
                <div className="mt-1 space-y-1">
                  {dayOcc.slice(0, 3).map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px]",
                        o.status === "cancelled"
                          ? "bg-rose-50 text-rose-700 line-through"
                          : o.status === "completed"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-[var(--brand)]/10 text-[var(--brand)]"
                      )}
                    >
                      {o.subject}
                    </div>
                  ))}
                  {dayOcc.length > 3 && (
                    <div className="text-[10px] text-slate-400">+{dayOcc.length - 3}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {selectedIso ? formatHebrewDate(selectedIso) : "בחרי יום"}
              </h3>
              <p className="text-sm text-slate-500">
                {selectedOccurrences.length} שיעורים ביום זה
              </p>
            </div>
            {selectedIso && (
              <Button size="sm" type="button" onClick={() => setCreating((v) => !v)}>
                {creating ? "סגירה" : "יצירת שיעור"}
              </Button>
            )}
          </div>

          {creating && selectedIso && (
            <div className="mb-4 rounded-xl border border-stone-100 bg-stone-50 p-3">
              <p className="mb-3 text-sm text-slate-600">
                השיעור ייווצר לתבנית השבועית, ויווצר גם מופע ליום {formatHebrewDate(selectedIso)}.
              </p>
              <LessonsForm
                yearId={yearId}
                occurrenceDate={selectedIso}
                teachingAssignments={teachingAssignments}
                grades={grades}
                classes={classes}
                tracks={tracks}
                specializations={specializations}
                ranges={ranges}
                rules={rules}
                onCreated={() => {
                  setCreating(false);
                  router.refresh();
                }}
              />
            </div>
          )}

          {selectedIso && selectedOccurrences.length === 0 && !creating && (
            <p className="text-sm text-slate-500">אין שיעורים ביום זה. ניתן ליצור שיעור חדש.</p>
          )}

          <div className="space-y-2">
            {selectedOccurrences.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-stone-100 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{o.subject}</p>
                    <p className="text-xs text-slate-500">
                      {OCCURRENCE_STATUS_LABELS[o.status as keyof typeof OCCURRENCE_STATUS_LABELS] ??
                        o.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {o.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="danger"
                        type="button"
                        onClick={() => setStatus(o.id, "cancel")}
                      >
                        ביטול
                      </Button>
                    )}
                    {o.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => setStatus(o.id, "complete")}
                      >
                        הושלם
                      </Button>
                    )}
                    {o.status === "cancelled" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => setStatus(o.id, "restore")}
                      >
                        שחזור
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">תבניות שיעור קבועות</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {lessons.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 border-b border-stone-50 pb-2">
                <span>{l.subject}</span>
                <span className="text-slate-400">שיעור {l.lesson_number}</span>
              </li>
            ))}
            {lessons.length === 0 && <li>אין תבניות עדיין.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
