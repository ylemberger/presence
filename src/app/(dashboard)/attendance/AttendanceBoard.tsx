"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewMonthCalendar } from "@/components/ui/HebrewMonthCalendar";
import { bulkAttendanceAction, upsertAttendanceAction, upsertAttendanceNoteAction } from "../actions";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";
import {
  AttendanceStatusPicker,
  type AttendancePickerPhase,
} from "./AttendanceStatusPicker";

export type AttendanceMode = "single" | "group";

export interface AttendanceStudent {
  id: string;
  full_name: string;
}

export interface DayLessonRow {
  id: string;
  date: string;
  subject: string;
  teacherName: string;
  lessonId: string;
  studentCount: number;
  markedCount: number;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  yearId: string;
  monthFrom: string;
  monthTo: string;
  selectedDate: string;
  selectedOccurrenceId?: string;
  mode: AttendanceMode;
  classId?: string;
  trackId?: string;
  specializationId?: string;
  teacherId?: string;
  subject?: string;
  studentId?: string;
  classes: Option[];
  tracks: Option[];
  specializations: Option[];
  teachers: Option[];
  subjects: string[];
  allStudents: AttendanceStudent[];
  monthOccurrences: Array<{ id: string; date: string }>;
  dayOccurrences: DayLessonRow[];
  lessonStudents: AttendanceStudent[];
  attendance: { student_id: string; lesson_occurrence_id: string; status: string }[];
  noteBody?: string;
  noteLessonId?: string | null;
}

type DraftKey = string;

function keyOf(studentId: string, occurrenceId: string): DraftKey {
  return `${studentId}::${occurrenceId}`;
}

export function AttendanceBoard({
  yearId,
  monthFrom,
  selectedDate,
  selectedOccurrenceId,
  mode,
  classId,
  trackId,
  specializationId,
  teacherId,
  subject,
  studentId,
  classes,
  tracks,
  specializations,
  teachers,
  subjects,
  allStudents,
  monthOccurrences,
  dayOccurrences,
  lessonStudents,
  attendance,
  noteBody = "",
  noteLessonId = null,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<DraftKey, AttendanceStatus | null>>({});
  const [cellPhase, setCellPhase] = useState<Record<DraftKey, AttendancePickerPhase>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState(noteBody);
  const [noteSaving, setNoteSaving] = useState(false);

  const activeOccurrenceId =
    selectedOccurrenceId && dayOccurrences.some((o) => o.id === selectedOccurrenceId)
      ? selectedOccurrenceId
      : dayOccurrences.length === 1
        ? dayOccurrences[0].id
        : undefined;

  const activeLesson = dayOccurrences.find((o) => o.id === activeOccurrenceId);

  useEffect(() => {
    setNote(noteBody);
  }, [noteBody]);

  useEffect(() => {
    if (!activeOccurrenceId) {
      setDraft({});
      return;
    }
    const byKey = new Map<string, AttendanceStatus>();
    for (const a of attendance) {
      if (a.lesson_occurrence_id === activeOccurrenceId) {
        byKey.set(keyOf(a.student_id, a.lesson_occurrence_id), a.status as AttendanceStatus);
      }
    }
    const next: Record<DraftKey, AttendanceStatus | null> = {};
    for (const student of lessonStudents) {
      next[keyOf(student.id, activeOccurrenceId)] =
        byKey.get(keyOf(student.id, activeOccurrenceId)) ?? null;
    }
    setDraft(next);
    setCellPhase({});
    setMessage(null);
  }, [lessonStudents, attendance, activeOccurrenceId]);

  const countsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of monthOccurrences) {
      counts[o.date] = (counts[o.date] ?? 0) + 1;
    }
    return counts;
  }, [monthOccurrences]);

  function buildParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    params.set("date", patch.date ?? selectedDate);
    params.set("from", patch.from ?? monthFrom);
    if (patch.to) params.set("to", patch.to);
    params.set("mode", patch.mode ?? mode);
    const filters = {
      classId: patch.classId !== undefined ? patch.classId : classId,
      trackId: patch.trackId !== undefined ? patch.trackId : trackId,
      specializationId:
        patch.specializationId !== undefined ? patch.specializationId : specializationId,
      teacherId: patch.teacherId !== undefined ? patch.teacherId : teacherId,
      subject: patch.subject !== undefined ? patch.subject : subject,
      studentId: patch.studentId !== undefined ? patch.studentId : studentId,
      occurrenceId: patch.occurrenceId,
    };
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    return params;
  }

  function navigate(params: URLSearchParams) {
    router.push(`/attendance?${params.toString()}`);
  }

  function selectDate(iso: string) {
    navigate(buildParams({ date: iso, occurrenceId: undefined }));
  }

  function selectLesson(occurrenceId: string) {
    navigate(buildParams({ occurrenceId }));
  }

  function updateFilter(key: string, value: string | undefined) {
    navigate(buildParams({ [key]: value, occurrenceId: undefined }));
  }

  async function pickStatus(studentId: string, occurrenceId: string, status: AttendanceStatus) {
    const k = keyOf(studentId, occurrenceId);
    const previous = draft[k] ?? null;

    setDraft((prev) => ({ ...prev, [k]: status }));
    setCellPhase((prev) => ({ ...prev, [k]: "saving" }));
    setMessage(null);

    const result = await upsertAttendanceAction(studentId, occurrenceId, status);
    if (result && "error" in result && result.error) {
      setDraft((prev) => ({ ...prev, [k]: previous }));
      setCellPhase((prev) => ({ ...prev, [k]: "error" }));
      setMessage(result.error);
      window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 2000);
      return;
    }

    setCellPhase((prev) => ({ ...prev, [k]: "saved" }));
    window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 1200);
    router.refresh();
  }

  async function markAll(status: AttendanceStatus) {
    if (!activeOccurrenceId || lessonStudents.length === 0) return;
    setBulkSaving(true);
    setMessage(null);

    const updates = lessonStudents.map((s) => ({
      studentId: s.id,
      occurrenceId: activeOccurrenceId,
      status,
    }));

    const next = { ...draft };
    for (const u of updates) {
      next[keyOf(u.studentId, u.occurrenceId)] = status;
    }
    setDraft(next);

    const result = await bulkAttendanceAction(updates);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
    } else {
      setMessage(`נשמר — ${updates.length} תלמידות`);
      router.refresh();
    }
    setBulkSaving(false);
  }

  async function saveNote() {
    if (!noteLessonId) return;
    setNoteSaving(true);
    const fd = new FormData();
    fd.set("academic_year_id", yearId);
    fd.set("body", note);
    fd.set("lesson_id", noteLessonId);
    const result = await upsertAttendanceNoteAction(fd);
    if (result && "error" in result && result.error) setMessage(result.error);
    else {
      setMessage("ההערה נשמרה");
      router.refresh();
    }
    setNoteSaving(false);
  }

  const canMark = Boolean(activeOccurrenceId) && lessonStudents.length > 0;

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["group", "קבוצה"],
              ["single", "תלמידה בודדת"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                navigate(
                  buildParams({
                    mode: value,
                    studentId: value === "group" ? undefined : studentId,
                    occurrenceId: undefined,
                  })
                )
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                mode === value
                  ? "bg-[var(--brand)] text-white"
                  : "bg-stone-50 text-slate-600 ring-1 ring-stone-200 hover:bg-stone-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
          {mode === "single" && (
            <Select
              label="תלמידה"
              value={studentId ?? ""}
              onChange={(e) => updateFilter("studentId", e.target.value || undefined)}
              options={[
                { value: "", label: "בחרי תלמידה" },
                ...allStudents.map((s) => ({ value: s.id, label: s.full_name })),
              ]}
            />
          )}
          <Select
            label="כיתה"
            value={classId ?? ""}
            onChange={(e) => updateFilter("classId", e.target.value || undefined)}
            options={[{ value: "", label: "הכל" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select
            label="מסלול"
            value={trackId ?? ""}
            onChange={(e) => updateFilter("trackId", e.target.value || undefined)}
            options={[{ value: "", label: "הכל" }, ...tracks.map((t) => ({ value: t.id, label: t.name }))]}
          />
          <Select
            label="מורה"
            value={teacherId ?? ""}
            onChange={(e) => updateFilter("teacherId", e.target.value || undefined)}
            options={[{ value: "", label: "הכל" }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]}
          />
          <Select
            label="מקצוע"
            value={subject ?? ""}
            onChange={(e) => updateFilter("subject", e.target.value || undefined)}
            options={[{ value: "", label: "הכל" }, ...subjects.map((s) => ({ value: s, label: s }))]}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* calendar */}
        <HebrewMonthCalendar
          initialMonthIso={monthFrom}
          selectedDate={selectedDate}
          countsByDate={countsByDate}
          onSelectDate={selectDate}
          onMonthRangeChange={(from, to) => {
            navigate(buildParams({ from, to, date: selectedDate, occurrenceId: undefined }));
          }}
        />

        {/* day panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">
              {formatHebrewDate(selectedDate)}
            </h3>
            <p className="text-xs text-slate-500">{formatGregorianDate(selectedDate)}</p>
            <p className="mt-2 text-sm text-slate-600">
              {dayOccurrences.length === 0
                ? "אין שיעורים ביום זה (לפי הסינון)."
                : `${dayOccurrences.length} שיעורים — בחרי שיעור לרישום נוכחות`}
            </p>

            <ul className="mt-3 space-y-2">
              {dayOccurrences.map((o) => {
                const selected = o.id === activeOccurrenceId;
                const complete = o.studentCount > 0 && o.markedCount >= o.studentCount;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => selectLesson(o.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-right transition-colors",
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand)]/5 ring-1 ring-[var(--brand)]/30"
                          : "border-stone-100 bg-stone-50/50 hover:bg-stone-50"
                      )}
                    >
                      <div className="font-medium text-slate-800">{o.subject}</div>
                      <div className="text-xs text-slate-500">{o.teacherName || "—"}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {o.markedCount}/{o.studentCount} נרשמו
                        {complete && (
                          <span className="mr-2 text-emerald-600">· הושלם</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {dayOccurrences.length === 0 && (
              <Link
                href="/lessons"
                className="mt-3 inline-block text-sm font-medium text-[var(--brand)] hover:underline"
              >
                מעבר לשיעורים
              </Link>
            )}
          </div>

          {/* marking panel */}
          {activeLesson && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{activeLesson.subject}</h3>
                  <p className="text-xs text-slate-500">{activeLesson.teacherName}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("present")}>
                    {bulkSaving ? "..." : "נוכחות לכולן"}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("late")}>
                    איחור
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("absent")}>
                    היעדרות
                  </Button>
                </div>
              </div>

              {message && (
                <p
                  className={cn(
                    "mb-3 text-xs",
                    message.includes("שגיא") ? "text-red-600" : "text-emerald-700"
                  )}
                >
                  {message}
                </p>
              )}

              {mode === "single" && !studentId && (
                <p className="text-sm text-slate-500">בחרי תלמידה למעלה.</p>
              )}

              {canMark && lessonStudents.length === 0 && (
                <p className="text-sm text-slate-500">
                  אין תלמידות משויכות לשיעור זה.{" "}
                  <Link href="/students" className="text-[var(--brand)] hover:underline">
                    בדקי שיוכים
                  </Link>
                </p>
              )}

              <ul className="space-y-2">
                {lessonStudents.map((student) => {
                  const k = keyOf(student.id, activeOccurrenceId!);
                  return (
                    <li
                      key={student.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 px-3 py-2"
                    >
                      <span className="font-medium text-slate-800">{student.full_name}</span>
                      <AttendanceStatusPicker
                        value={draft[k] ?? null}
                        phase={cellPhase[k] ?? "idle"}
                        onPick={(s) => pickStatus(student.id, activeOccurrenceId!, s)}
                        compact
                      />
                    </li>
                  );
                })}
              </ul>

              {noteLessonId && (
                <div className="mt-4 border-t border-stone-100 pt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    הערה לשיעור (לא מודפסת)
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="min-h-[2.5rem] flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    />
                    <Button type="button" size="sm" variant="secondary" disabled={noteSaving} onClick={saveNote}>
                      {noteSaving ? "..." : "שמור"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!activeLesson && dayOccurrences.length > 1 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              יש {dayOccurrences.length} שיעורים ביום זה — בחרי שיעור מהרשימה.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
