"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_CYCLE } from "@/lib/constants";
import { upsertAttendanceAction, bulkAttendanceAction } from "../actions";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import { addDays } from "@/lib/dates/hebrew";

interface AttendanceJournalProps {
  weekStart: string;
  weekLabel: string;
  classes: { id: string; name: string }[];
  selectedClassId?: string;
  students: { id: string; full_name: string }[];
  occurrences: { id: string; date: string; subject: string }[];
  attendance: { student_id: string; lesson_occurrence_id: string; status: string }[];
}

const CELL: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  absent: "bg-rose-500 text-white",
  late: "bg-amber-400 text-slate-900",
};

export function AttendanceJournal({
  weekStart,
  weekLabel,
  classes,
  selectedClassId,
  students,
  occurrences,
  attendance,
}: AttendanceJournalProps) {
  const router = useRouter();
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("present");
  const [loading, setLoading] = useState(false);

  function getStatus(studentId: string, occurrenceId: string): AttendanceStatus | null {
    const record = attendance.find(
      (a) => a.student_id === studentId && a.lesson_occurrence_id === occurrenceId
    );
    return (record?.status as AttendanceStatus) ?? null;
  }

  async function cycleStatus(studentId: string, occurrenceId: string) {
    const current = getStatus(studentId, occurrenceId);
    const nextIndex = current
      ? (ATTENDANCE_CYCLE.indexOf(current) + 1) % ATTENDANCE_CYCLE.length
      : 0;
    await upsertAttendanceAction(studentId, occurrenceId, ATTENDANCE_CYCLE[nextIndex]);
    router.refresh();
  }

  async function applyBulk() {
    if (!selectedClassId || occurrences.length === 0) return;
    setLoading(true);
    await bulkAttendanceAction(
      students.flatMap((s) =>
        occurrences.map((o) => ({
          studentId: s.id,
          occurrenceId: o.id,
          status: bulkStatus,
        }))
      )
    );
    router.refresh();
    setLoading(false);
  }

  function navigateWeek(offset: number) {
    const params = new URLSearchParams();
    params.set("week", addDays(weekStart, offset * 7));
    if (selectedClassId) params.set("classId", selectedClassId);
    router.push(`/attendance?${params.toString()}`);
  }

  function selectClass(id: string) {
    const params = new URLSearchParams();
    params.set("week", weekStart);
    if (id) params.set("classId", id);
    router.push(`/attendance?${params.toString()}`);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectClass(c.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                selectedClassId === c.id
                  ? "bg-[var(--brand)] text-white"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigateWeek(-1)}>
            הקודם
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700">
            {weekLabel}
          </span>
          <Button variant="secondary" size="sm" onClick={() => navigateWeek(1)}>
            הבא
          </Button>
        </div>
      </div>

      {selectedClassId && occurrences.length > 0 && students.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
          <span className="text-sm text-slate-500">סימון מהיר:</span>
          {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setBulkStatus(status)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                bulkStatus === status ? CELL[status] : "bg-stone-100 text-slate-600"
              )}
            >
              {ATTENDANCE_STATUS_LABELS[status]}
            </button>
          ))}
          <Button size="sm" onClick={applyBulk} disabled={loading}>
            החל על כל הכיתה
          </Button>
        </div>
      )}

      {!selectedClassId ? (
        <p className="px-5 py-12 text-center text-slate-500">בחרי כיתה כדי לפתוח את יומן הנוכחות.</p>
      ) : students.length === 0 ? (
        <p className="px-5 py-12 text-center text-slate-500">אין תלמידות משובצות בכיתה זו.</p>
      ) : occurrences.length === 0 ? (
        <p className="px-5 py-12 text-center text-slate-500">אין שיעורים בשבוע הזה. צריך לייצר מופעים ממסך השיעורים.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="sticky right-0 z-10 bg-stone-50 px-4 py-3 text-right font-semibold text-slate-600">
                  תלמידה
                </th>
                {occurrences.map((o) => (
                  <th key={o.id} className="px-2 py-3 text-center font-medium">
                    <div className="text-slate-800">{formatHebrewDate(o.date)}</div>
                    <div className="text-xs font-normal text-slate-500">{o.subject}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-stone-100">
                  <td className="sticky right-0 z-10 bg-white px-4 py-2 font-medium text-slate-800">
                    {student.full_name}
                  </td>
                  {occurrences.map((o) => {
                    const status = getStatus(student.id, o.id);
                    return (
                      <td key={o.id} className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => cycleStatus(student.id, o.id)}
                          className={cn(
                            "h-10 w-full rounded-lg text-xs font-semibold transition-transform hover:scale-[1.03]",
                            status ? CELL[status] : "bg-stone-100 text-slate-400"
                          )}
                        >
                          {status ? ATTENDANCE_STATUS_LABELS[status] : "רישום"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
