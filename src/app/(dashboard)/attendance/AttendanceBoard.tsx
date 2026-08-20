"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { bulkAttendanceAction } from "../actions";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { addDays, formatHebrewDate } from "@/lib/dates/hebrew";

export type AttendanceMode = "single" | "group";
export type AttendanceView = "lesson" | "date" | "teacher" | "group";

export interface AttendanceStudent {
  id: string;
  full_name: string;
}

export interface AttendanceOccurrence {
  id: string;
  date: string;
  subject: string;
  teacherName: string;
  lessonId: string;
  classId: string | null;
  trackId: string | null;
  specializationId: string | null;
}

interface Filters {
  mode: AttendanceMode;
  view: AttendanceView;
  weekStart: string;
  weekLabel: string;
  classId?: string;
  trackId?: string;
  specializationId?: string;
  teacherId?: string;
  subject?: string;
  studentId?: string;
  occurrenceId?: string;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  filters: Filters;
  classes: Option[];
  tracks: Option[];
  specializations: Option[];
  teachers: Option[];
  subjects: string[];
  students: AttendanceStudent[];
  allStudents: AttendanceStudent[];
  occurrences: AttendanceOccurrence[];
  attendance: { student_id: string; lesson_occurrence_id: string; status: string }[];
}

const CELL: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white border-emerald-600",
  absent: "bg-rose-500 text-white border-rose-600",
  late: "bg-amber-400 text-slate-900 border-amber-500",
};

type DraftKey = string;

function keyOf(studentId: string, occurrenceId: string): DraftKey {
  return `${studentId}::${occurrenceId}`;
}

export function AttendanceBoard({
  filters,
  classes,
  tracks,
  specializations,
  teachers,
  subjects,
  students,
  allStudents,
  occurrences,
  attendance,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<DraftKey, AttendanceStatus | null>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<DraftKey, AttendanceStatus | null> = {};
    for (const student of students) {
      for (const occ of occurrences) {
        const record = attendance.find(
          (a) => a.student_id === student.id && a.lesson_occurrence_id === occ.id
        );
        next[keyOf(student.id, occ.id)] = (record?.status as AttendanceStatus) ?? null;
      }
    }
    setDraft(next);
    setDirty(false);
    setMessage(null);
  }, [students, occurrences, attendance]);

  const visibleOccurrences = useMemo(() => {
    if (filters.view === "lesson" && filters.occurrenceId) {
      return occurrences.filter((o) => o.id === filters.occurrenceId);
    }
    if (filters.view === "date") {
      const byDate = [...occurrences].sort((a, b) => a.date.localeCompare(b.date));
      return byDate;
    }
    if (filters.view === "teacher") {
      return [...occurrences].sort((a, b) => a.teacherName.localeCompare(b.teacherName, "he"));
    }
    return occurrences;
  }, [occurrences, filters.view, filters.occurrenceId]);

  function pushFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    params.set("mode", next.mode);
    params.set("view", next.view);
    params.set("week", next.weekStart);
    if (next.classId) params.set("classId", next.classId);
    if (next.trackId) params.set("trackId", next.trackId);
    if (next.specializationId) params.set("specializationId", next.specializationId);
    if (next.teacherId) params.set("teacherId", next.teacherId);
    if (next.subject) params.set("subject", next.subject);
    if (next.studentId) params.set("studentId", next.studentId);
    if (next.occurrenceId) params.set("occurrenceId", next.occurrenceId);
    router.push(`/attendance?${params.toString()}`);
  }

  function setStatus(studentId: string, occurrenceId: string, status: AttendanceStatus | null) {
    setDraft((prev) => ({ ...prev, [keyOf(studentId, occurrenceId)]: status }));
    setDirty(true);
    setMessage(null);
  }

  function markAllPresent() {
    const next = { ...draft };
    for (const student of students) {
      for (const occ of visibleOccurrences) {
        next[keyOf(student.id, occ.id)] = "present";
      }
    }
    setDraft(next);
    setDirty(true);
    setMessage(null);
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    const updates = Object.entries(draft)
      .filter(([, status]) => status != null)
      .map(([key, status]) => {
        const [studentId, occurrenceId] = key.split("::");
        return {
          studentId,
          occurrenceId,
          status: status as AttendanceStatus,
        };
      });

    if (updates.length === 0) {
      setMessage("אין רישומים לשמירה");
      setSaving(false);
      return;
    }

    const result = await bulkAttendanceAction(updates);
    if (result && "error" in result && result.error) setMessage(result.error);
    else {
      setDirty(false);
      setMessage("הנוכחות נשמרה");
      router.refresh();
    }
    setSaving(false);
  }

  const canShowGrid =
    students.length > 0 &&
    visibleOccurrences.length > 0 &&
    (filters.mode === "single" ? Boolean(filters.studentId) : true);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)] print:shadow-none print:border-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-4 print:hidden">
        {(
          [
            ["single", "בת יחידה"],
            ["group", "קבוצה"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => pushFilters({ mode: value, studentId: value === "group" ? undefined : filters.studentId })}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              filters.mode === value
                ? "bg-[var(--brand)] text-white"
                : "bg-stone-100 text-slate-600 hover:bg-stone-200"
            )}
          >
            {label}
          </button>
        ))}
        <div className="mx-2 h-6 w-px bg-stone-200" />
        {(
          [
            ["date", "לפי תאריך"],
            ["lesson", "לפי שיעור"],
            ["teacher", "לפי מורה"],
            ["group", "לפי קבוצה"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => pushFilters({ view: value })}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              filters.view === value
                ? "bg-slate-800 text-white"
                : "bg-stone-100 text-slate-600 hover:bg-stone-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 border-b border-stone-100 px-5 py-4 md:grid-cols-3 lg:grid-cols-4 print:hidden">
        {filters.mode === "single" && (
          <Select
            label="תלמידה"
            value={filters.studentId ?? ""}
            onChange={(e) => pushFilters({ studentId: e.target.value || undefined })}
            options={[
              { value: "", label: "בחרי תלמידה" },
              ...allStudents.map((s) => ({ value: s.id, label: s.full_name })),
            ]}
          />
        )}
        <Select
          label="כיתה"
          value={filters.classId ?? ""}
          onChange={(e) => pushFilters({ classId: e.target.value || undefined })}
          options={[
            { value: "", label: "הכל" },
            ...classes.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          label="מסלול"
          value={filters.trackId ?? ""}
          onChange={(e) => pushFilters({ trackId: e.target.value || undefined })}
          options={[
            { value: "", label: "הכל" },
            ...tracks.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Select
          label="התמחות"
          value={filters.specializationId ?? ""}
          onChange={(e) => pushFilters({ specializationId: e.target.value || undefined })}
          options={[
            { value: "", label: "הכל" },
            ...specializations.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Select
          label="מורה"
          value={filters.teacherId ?? ""}
          onChange={(e) => pushFilters({ teacherId: e.target.value || undefined })}
          options={[
            { value: "", label: "הכל" },
            ...teachers.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Select
          label="מקצוע"
          value={filters.subject ?? ""}
          onChange={(e) => pushFilters({ subject: e.target.value || undefined })}
          options={[
            { value: "", label: "הכל" },
            ...subjects.map((s) => ({ value: s, label: s })),
          ]}
        />
        {filters.view === "lesson" && (
          <Select
            label="שיעור"
            value={filters.occurrenceId ?? ""}
            onChange={(e) => pushFilters({ occurrenceId: e.target.value || undefined })}
            options={[
              { value: "", label: "בחרי שיעור" },
              ...occurrences.map((o) => ({
                value: o.id,
                label: `${formatHebrewDate(o.date)} · ${o.subject}`,
              })),
            ]}
          />
        )}
        <div className="flex items-end gap-2 md:col-span-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pushFilters({ weekStart: addDays(filters.weekStart, -7) })}
          >
            שבוע קודם
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium text-slate-700">
            {filters.weekLabel}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pushFilters({ weekStart: addDays(filters.weekStart, 7) })}
          >
            שבוע הבא
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3 print:hidden">
        <Button size="sm" variant="secondary" onClick={markAllPresent} disabled={!canShowGrid}>
          סמן את כולן כנוכחות
        </Button>
        <Button size="sm" onClick={saveAll} disabled={!dirty || saving || !canShowGrid}>
          {saving ? "שומר..." : "שמור את כל הרשימה"}
        </Button>
        {dirty && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
        {message && <span className="text-xs text-slate-600">{message}</span>}
      </div>

      <div className="hidden print:block px-2 py-3 text-sm">
        <div className="font-semibold">יומן נוכחות</div>
        <div>{filters.weekLabel}</div>
      </div>

      {!canShowGrid ? (
        <p className="px-5 py-12 text-center text-slate-500">
          {filters.mode === "single" && !filters.studentId
            ? "בחרי תלמידה כדי לפתוח רישום נוכחות."
            : students.length === 0
              ? "אין תלמידות שמתאימות למסננים שנבחרו."
              : "אין שיעורים בשבוע הזה לפי המסננים שנבחרו."}
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="sticky right-0 z-10 bg-stone-50 px-4 py-3 text-right font-semibold text-slate-600">
                  תלמידה
                </th>
                {visibleOccurrences.map((o) => (
                  <th key={o.id} className="px-2 py-3 text-center font-medium">
                    <div className="text-slate-800">{formatHebrewDate(o.date)}</div>
                    <div className="text-xs font-normal text-slate-500">{o.subject}</div>
                    {filters.view === "teacher" && (
                      <div className="text-[11px] font-normal text-slate-400">{o.teacherName}</div>
                    )}
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
                  {visibleOccurrences.map((o) => {
                    const status = draft[keyOf(student.id, o.id)] ?? null;
                    return (
                      <td key={o.id} className="p-1.5 text-center">
                        <div className="flex flex-col gap-1">
                          {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map(
                            (option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setStatus(student.id, o.id, option)}
                                className={cn(
                                  "rounded-md border px-1 py-1 text-[11px] font-semibold transition-colors print:border-stone-300",
                                  status === option
                                    ? CELL[option]
                                    : "border-stone-200 bg-stone-50 text-slate-500 hover:bg-stone-100"
                                )}
                              >
                                {ATTENDANCE_STATUS_LABELS[option]}
                              </button>
                            )
                          )}
                        </div>
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
