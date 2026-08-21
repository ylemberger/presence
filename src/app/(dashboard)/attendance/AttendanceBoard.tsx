"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { bulkAttendanceAction, upsertAttendanceNoteAction } from "../actions";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { addDays, formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";
import { AttendanceGapModal, type GapItem } from "./AttendanceGapModal";

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
  yearId: string;
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
  pastGaps?: GapItem[];
  siblingDates?: Array<{ occurrenceId: string; lessonId: string; date: string; subject: string }>;
  noteBody?: string;
  noteLessonId?: string | null;
  noteStudentId?: string | null;
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

function DateStack({ iso }: { iso: string }) {
  return (
    <div className="leading-tight">
      <div className="font-semibold text-slate-800">{formatHebrewDate(iso)}</div>
      <div className="text-[11px] text-slate-400">{formatGregorianDate(iso)}</div>
    </div>
  );
}

export function AttendanceBoard({
  yearId,
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
  pastGaps = [],
  siblingDates = [],
  noteBody = "",
  noteLessonId = null,
  noteStudentId = null,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<DraftKey, AttendanceStatus | null>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState(noteBody);
  const [noteSaving, setNoteSaving] = useState(false);
  const [dismissedSoftIds, setDismissedSoftIds] = useState<string[]>([]);

  useEffect(() => {
    setNote(noteBody);
  }, [noteBody]);

  useEffect(() => {
    const byKey = new Map<string, AttendanceStatus>();
    for (const a of attendance) {
      byKey.set(keyOf(a.student_id, a.lesson_occurrence_id), a.status as AttendanceStatus);
    }
    const next: Record<DraftKey, AttendanceStatus | null> = {};
    for (const student of students) {
      for (const occ of occurrences) {
        next[keyOf(student.id, occ.id)] = byKey.get(keyOf(student.id, occ.id)) ?? null;
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
      return [...occurrences].sort((a, b) => a.date.localeCompare(b.date));
    }
    if (filters.view === "teacher") {
      return [...occurrences].sort((a, b) => a.teacherName.localeCompare(b.teacherName, "he"));
    }
    return occurrences;
  }, [occurrences, filters.view, filters.occurrenceId]);

  const relevantGaps = useMemo(() => {
    const lessonIds = new Set(
      (filters.occurrenceId
        ? occurrences.filter((o) => o.id === filters.occurrenceId)
        : occurrences
      ).map((o) => o.lessonId)
    );
    if (lessonIds.size === 0 && pastGaps.length) return pastGaps.slice(0, 1);
    return pastGaps.filter((g) => lessonIds.has(g.lessonId) || lessonIds.size === 0);
  }, [pastGaps, occurrences, filters.occurrenceId]);

  const blockingGap = relevantGaps.find((g) => !g.gapHandling) ?? null;
  const softGap =
    !blockingGap
      ? relevantGaps.find(
          (g) => g.gapHandling && !dismissedSoftIds.includes(g.occurrenceId)
        ) ?? null
      : null;
  const activeGap = blockingGap ?? softGap;
  const gridLocked = Boolean(blockingGap);

  const focusLessonId =
    visibleOccurrences[0]?.lessonId ??
    (filters.occurrenceId
      ? occurrences.find((o) => o.id === filters.occurrenceId)?.lessonId
      : undefined);

  const lessonSiblingDates = useMemo(() => {
    if (!focusLessonId) return [];
    return siblingDates
      .filter((s) => s.lessonId === focusLessonId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [siblingDates, focusLessonId]);

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

  function jumpToOccurrence(occurrenceId: string, date: string) {
    const week = (() => {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      dt.setDate(dt.getDate() - dt.getDay());
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    })();
    pushFilters({
      view: "lesson",
      mode: "group",
      weekStart: week,
      occurrenceId,
    });
  }

  function setStatus(studentId: string, occurrenceId: string, status: AttendanceStatus | null) {
    if (gridLocked) return;
    setDraft((prev) => ({ ...prev, [keyOf(studentId, occurrenceId)]: status }));
    setDirty(true);
    setMessage(null);
  }

  function markAll(status: AttendanceStatus) {
    if (gridLocked) return;
    const next = { ...draft };
    for (const student of students) {
      for (const occ of visibleOccurrences) {
        next[keyOf(student.id, occ.id)] = status;
      }
    }
    setDraft(next);
    setDirty(true);
    setMessage(null);
  }

  async function saveAll() {
    if (gridLocked) return;
    setSaving(true);
    setMessage(null);
    const updates = Object.entries(draft)
      .filter(([, status]) => status != null)
      .map(([key, status]) => {
        const [studentId, occurrenceId] = key.split("::");
        return { studentId, occurrenceId, status: status as AttendanceStatus };
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

  async function saveNote() {
    setNoteSaving(true);
    const fd = new FormData();
    fd.set("academic_year_id", yearId);
    fd.set("body", note);
    if (filters.mode === "single" && filters.studentId) {
      fd.set("student_id", filters.studentId);
    } else if (noteLessonId || focusLessonId) {
      fd.set("lesson_id", noteLessonId || focusLessonId || "");
    } else {
      setNoteSaving(false);
      setMessage("בחרי שיעור או תלמידה כדי לשמור הערה כללית");
      return;
    }
    const result = await upsertAttendanceNoteAction(fd);
    if (result && "error" in result && result.error) setMessage(result.error);
    else {
      setMessage("ההערה נשמרה");
      router.refresh();
    }
    setNoteSaving(false);
  }

  const canShowGrid =
    !gridLocked &&
    students.length > 0 &&
    visibleOccurrences.length > 0 &&
    (filters.mode === "single" ? Boolean(filters.studentId) : true);

  const showNoteBox =
    (filters.mode === "single" && filters.studentId) ||
    Boolean(focusLessonId) ||
    Boolean(noteStudentId) ||
    Boolean(noteLessonId);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)] print:border-0 print:shadow-none">
      {activeGap && (
        <AttendanceGapModal
          gap={activeGap}
          soft={!blockingGap}
          onResolved={() => {
            if (activeGap.gapHandling) {
              setDismissedSoftIds((ids) => [...ids, activeGap.occurrenceId]);
            }
          }}
          onMarkAttendance={(g) => jumpToOccurrence(g.occurrenceId, g.date)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["single", "בת יחידה"],
              ["group", "קבוצה"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                pushFilters({
                  mode: value,
                  studentId: value === "group" ? undefined : filters.studentId,
                })
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                filters.mode === value
                  ? "bg-[var(--brand)]/90 text-white"
                  : "bg-white text-slate-600 ring-1 ring-stone-200 hover:bg-stone-100"
              )}
            >
              {label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-stone-200" />
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
                "rounded-lg px-2.5 py-1.5 text-xs font-medium",
                filters.view === value
                  ? "bg-teal-700/90 text-white"
                  : "bg-white text-slate-600 ring-1 ring-stone-200 hover:bg-stone-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800">
            {filters.weekLabel.split("–")[0]?.trim() || filters.weekLabel}
          </div>
          <div className="text-[11px] text-slate-400">
            {formatGregorianDate(filters.weekStart)} –{" "}
            {formatGregorianDate(addDays(filters.weekStart, 6))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-b border-stone-100 px-4 py-3 md:grid-cols-3 lg:grid-cols-4 print:hidden">
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
        {(filters.view === "lesson" || lessonSiblingDates.length > 0) && (
          <Select
            label="תאריך שיעור (רק ימי השיעור)"
            value={filters.occurrenceId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                pushFilters({ occurrenceId: undefined });
                return;
              }
              const row =
                lessonSiblingDates.find((s) => s.occurrenceId === id) ||
                occurrences.find((o) => o.id === id);
              if (row && "date" in row) jumpToOccurrence(id, row.date);
              else pushFilters({ occurrenceId: id, view: "lesson" });
            }}
            options={[
              { value: "", label: "בחרי מופע" },
              ...(lessonSiblingDates.length
                ? lessonSiblingDates
                : occurrences.map((o) => ({
                    occurrenceId: o.id,
                    date: o.date,
                    subject: o.subject,
                  }))
              ).map((o) => ({
                value: o.occurrenceId,
                label: `${formatHebrewDate(o.date)} · ${formatGregorianDate(o.date)} · ${o.subject}`,
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pushFilters({ weekStart: addDays(filters.weekStart, 7) })}
          >
            שבוע הבא
          </Button>
        </div>
      </div>

      {showNoteBox && (
        <div className="border-b border-stone-100 px-4 py-3 print:hidden">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            הערה כללית {filters.mode === "single" ? "(לתלמידה)" : "(לשיעור)"} — לא מודפסת בדוחות
          </label>
          <div className="flex gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="min-h-[2.5rem] flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
              placeholder="דברים חשובים לזכור לגבי נוכחות..."
            />
            <Button type="button" size="sm" variant="secondary" disabled={noteSaving} onClick={saveNote}>
              {noteSaving ? "..." : "שמור הערה"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3 print:hidden">
        <Button size="sm" variant="secondary" onClick={() => markAll("present")} disabled={!canShowGrid}>
          סמן נוכחות לכולן
        </Button>
        <Button size="sm" variant="secondary" onClick={() => markAll("late")} disabled={!canShowGrid}>
          סמן איחור לכולן
        </Button>
        <Button size="sm" variant="secondary" onClick={() => markAll("absent")} disabled={!canShowGrid}>
          סמן היעדרות לכולן
        </Button>
        <Button size="sm" onClick={saveAll} disabled={!dirty || saving || !canShowGrid}>
          {saving ? "שומר..." : "שמור את כל הרשימה"}
        </Button>
        {canShowGrid && (
          <span className="text-xs text-slate-500">
            {students.length} תלמידות · {visibleOccurrences.length} שיעורים
          </span>
        )}
        {dirty && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
        {message && <span className="text-xs text-slate-600">{message}</span>}
      </div>

      {!canShowGrid ? (
        <div className="px-5 py-12 text-center text-slate-500">
          {gridLocked ? (
            <p>טפלי קודם במופע החסר בחלונית — ואז אפשר להמשיך לסמן נוכחות.</p>
          ) : filters.mode === "single" && !filters.studentId ? (
            <p>בחרי תלמידה כדי לפתוח רישום נוכחות.</p>
          ) : students.length === 0 ? (
            <p>
              אין תלמידות שמתאימות.{" "}
              <Link href="/students" className="font-medium text-[var(--brand)] hover:underline">
                מעבר לתלמידות
              </Link>
            </p>
          ) : (
            <p>
              אין שיעורים בשבוע הזה.{" "}
              <Link href="/lessons" className="font-medium text-[var(--brand)] hover:underline">
                מעבר לשיעורים
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-auto">
          <div className="border-b border-stone-100 bg-teal-50/40 px-4 py-3 print:hidden">
            <div className="flex flex-wrap items-end gap-4">
              {visibleOccurrences.map((o) => (
                <div key={o.id} className="min-w-[8rem]">
                  <DateStack iso={o.date} />
                  <div className="mt-0.5 text-xs font-medium text-teal-900">{o.subject}</div>
                  {o.teacherName && (
                    <div className="text-[11px] text-slate-500">{o.teacherName}</div>
                  )}
                </div>
              ))}
              <div className="text-sm text-slate-600">
                {students.length} תלמידות בקבוצה זו
              </div>
            </div>
          </div>
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="sticky right-0 z-10 bg-stone-50 px-4 py-3 text-right font-semibold text-slate-600">
                  תלמידה
                </th>
                {visibleOccurrences.map((o) => (
                  <th key={o.id} className="px-2 py-3 text-center font-medium">
                    <DateStack iso={o.date} />
                    <div className="mt-1 text-xs font-normal text-slate-500">{o.subject}</div>
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
                                  "rounded-md border px-1 py-1 text-[11px] font-semibold transition-colors",
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
