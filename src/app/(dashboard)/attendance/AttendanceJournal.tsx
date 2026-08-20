"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_COLORS, ATTENDANCE_CYCLE } from "@/lib/constants";
import { upsertAttendanceAction, bulkAttendanceAction } from "../actions";
import type { AttendanceStatus } from "@/types/database";

interface AttendanceJournalProps {
  weekStart: string;
  classes: { id: string; name: string }[];
  selectedClassId?: string;
  students: { id: string; full_name: string }[];
  occurrences: { id: string; date: string; subject: string }[];
  attendance: { student_id: string; lesson_occurrence_id: string; status: string }[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function AttendanceJournal({
  weekStart,
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
    const updates = students.flatMap((s) =>
      occurrences.map((o) => ({
        studentId: s.id,
        occurrenceId: o.id,
        status: bulkStatus,
      }))
    );
    await bulkAttendanceAction(updates);
    router.refresh();
    setLoading(false);
  }

  function navigateWeek(offset: number) {
    const newStart = addDays(weekStart, offset * 7);
    const params = new URLSearchParams();
    params.set("week", newStart);
    if (selectedClassId) params.set("classId", selectedClassId);
    router.push(`/attendance?${params.toString()}`);
  }

  return (
    <div>
      <div className="print:hidden mb-4 flex flex-wrap items-end gap-4">
        <Select
          label="כיתה"
          value={selectedClassId || ""}
          onChange={(e) => {
            const params = new URLSearchParams();
            params.set("week", weekStart);
            if (e.target.value) params.set("classId", e.target.value);
            router.push(`/attendance?${params.toString()}`);
          }}
          options={[
            { value: "", label: "בחרי כיתה" },
            ...classes.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigateWeek(-1)}>
            שבוע קודם
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigateWeek(1)}>
            שבוע הבא
          </Button>
        </div>
        {selectedClassId && occurrences.length > 0 && (
          <div className="flex items-end gap-2">
            <Select
              label="עדכון מרובה"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
              options={Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
            <Button size="sm" onClick={applyBulk} disabled={loading}>
              החל על כולן
            </Button>
          </div>
        )}
      </div>

      {!selectedClassId ? (
        <p className="text-gray-600">בחרי כיתה להצגת יומן הנוכחות.</p>
      ) : students.length === 0 ? (
        <p className="text-gray-600">אין תלמידות משובצות בכיתה זו.</p>
      ) : occurrences.length === 0 ? (
        <p className="text-gray-600">אין מופעי שיעור השבוע.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-right font-medium">תלמידה</th>
                {occurrences.map((o) => (
                  <th key={o.id} className="px-2 py-2 text-center font-medium">
                    <div>{o.date.slice(5)}</div>
                    <div className="text-xs text-gray-500">{o.subject}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{student.full_name}</td>
                  {occurrences.map((o) => {
                    const status = getStatus(student.id, o.id);
                    return (
                      <td key={o.id} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => cycleStatus(student.id, o.id)}
                          className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                            status
                              ? ATTENDANCE_COLORS[status]
                              : "border-gray-200 bg-gray-50 text-gray-400"
                          }`}
                        >
                          {status ? ATTENDANCE_STATUS_LABELS[status] : "—"}
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
