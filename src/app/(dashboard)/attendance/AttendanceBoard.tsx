"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewMonthCalendar } from "@/components/ui/HebrewMonthCalendar";
import {
  bulkAttendanceAction,
  syncLessonStudentsAction,
  upsertAttendanceAction,
  upsertAttendanceNoteAction,
} from "../actions";
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
  completeDates?: string[];
}

type DraftKey = string;

function keyOf(studentId: string, occurrenceId: string): DraftKey {
  return `${studentId}::${occurrenceId}`;
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        active && "bg-[var(--brand)]/10 ring-1 ring-[var(--brand)]/25",
        done && !active && "text-emerald-700"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          active ? "bg-[var(--brand)] text-white" : done ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-slate-500"
        )}
      >
        {done && !active ? "✓" : n}
      </span>
      <span className={cn("font-medium", active ? "text-[var(--brand)]" : "text-slate-600")}>{label}</span>
    </div>
  );
}

export function AttendanceBoard({
  yearId,
  monthFrom,
  monthTo,
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
  teachers,
  subjects,
  allStudents,
  monthOccurrences,
  dayOccurrences: dayOccurrencesProp,
  lessonStudents,
  attendance,
  noteBody = "",
  noteLessonId = null,
  completeDates = [],
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<DraftKey, AttendanceStatus | null>>({});
  const [cellPhase, setCellPhase] = useState<Record<DraftKey, AttendancePickerPhase>>({});
  const [dayOccurrences, setDayOccurrences] = useState(dayOccurrencesProp);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState(noteBody);
  const [noteSaving, setNoteSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setDayOccurrences(dayOccurrencesProp);
  }, [dayOccurrencesProp]);

  const activeOccurrenceId =
    selectedOccurrenceId && dayOccurrences.some((o) => o.id === selectedOccurrenceId)
      ? selectedOccurrenceId
      : undefined;

  const activeLesson = dayOccurrences.find((o) => o.id === activeOccurrenceId);

  const step = activeOccurrenceId ? 3 : 2;

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

  // auto-select when exactly one lesson on the day
  useEffect(() => {
    if (dayOccurrences.length === 1 && !selectedOccurrenceId) {
      const params = buildParams({ occurrenceId: dayOccurrences[0].id });
      router.replace(`/attendance?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOccurrences.length, selectedOccurrenceId, selectedDate]);

  const countsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of monthOccurrences) {
      counts[o.date] = (counts[o.date] ?? 0) + 1;
    }
    return counts;
  }, [monthOccurrences]);

  const completeDateSet = useMemo(() => new Set(completeDates), [completeDates]);

  function buildParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    params.set("date", patch.date ?? selectedDate);
    params.set("from", patch.from ?? monthFrom);
    params.set("to", patch.to ?? monthTo);
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

  function bumpMarkedCount(occurrenceId: string, delta: number) {
    setDayOccurrences((prev) =>
      prev.map((o) =>
        o.id === occurrenceId
          ? { ...o, markedCount: Math.max(0, Math.min(o.studentCount, o.markedCount + delta)) }
          : o
      )
    );
  }

  async function pickStatus(studentId: string, occurrenceId: string, status: AttendanceStatus) {
    const k = keyOf(studentId, occurrenceId);
    const previous = draft[k] ?? null;

    setDraft((prev) => ({ ...prev, [k]: status }));
    setCellPhase((prev) => ({ ...prev, [k]: "saving" }));
    setMessage(null);

    if (previous === null) bumpMarkedCount(occurrenceId, 1);

    const result = await upsertAttendanceAction(studentId, occurrenceId, status);
    if (result && "error" in result && result.error) {
      if (previous === null) bumpMarkedCount(occurrenceId, -1);
      setDraft((prev) => ({ ...prev, [k]: previous }));
      setCellPhase((prev) => ({ ...prev, [k]: "error" }));
      setMessage(result.error);
      window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 2000);
      return;
    }

    setCellPhase((prev) => ({ ...prev, [k]: "saved" }));
    window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 900);
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
    setDayOccurrences((prev) =>
      prev.map((o) =>
        o.id === activeOccurrenceId ? { ...o, markedCount: o.studentCount } : o
      )
    );

    const result = await bulkAttendanceAction(updates);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      router.refresh();
    } else {
      setMessage(`נשמר — ${updates.length} תלמידות`);
    }
    setBulkSaving(false);
  }

  async function syncStudents() {
    if (!activeLesson) return;
    setSyncing(true);
    setMessage(null);
    const result = await syncLessonStudentsAction(activeLesson.lessonId, yearId);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
    } else if (result && "success" in result) {
      const n = result.assigned ?? 0;
      setMessage(
        n > 0 ? `שויכו ${n} תלמידות לשיעור` : "לא נמצאו תלמידות חדשות לשיוך — בדקי כיתה/מסלול"
      );
      router.refresh();
    }
    setSyncing(false);
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
    else setMessage("ההערה נשמרה");
    setNoteSaving(false);
  }

  const canMark = Boolean(activeOccurrenceId) && lessonStudents.length > 0;
  const markedInLesson = activeOccurrenceId
    ? Object.keys(draft).filter((k) => k.endsWith(`::${activeOccurrenceId}`) && draft[k] !== null).length
    : 0;

  return (
    <div className="space-y-5">
      {/* steps */}
      <div className="flex flex-wrap gap-2">
        <StepBadge n={1} label="בחרי תאריך" active={step === 2 && !activeOccurrenceId} done />
        <StepBadge n={2} label="בחרי שיעור" active={step === 2 && !activeOccurrenceId} done={Boolean(activeOccurrenceId)} />
        <StepBadge n={3} label="סמני נוכחות" active={step === 3} done={false} />
      </div>

      {/* filters — collapsible */}
      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span>סינון (כיתה, מורה, מקצוע…)</span>
          <span className="text-slate-400">{filtersOpen ? "▲" : "▼"}</span>
        </button>
        {filtersOpen && (
          <div className="border-t border-stone-100 px-4 pb-4 pt-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ["group", "כל התלמידות"],
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
                      : "bg-stone-50 text-slate-600 ring-1 ring-stone-200"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
      </div>

      {/* calendar */}
      <HebrewMonthCalendar
        initialMonthIso={monthFrom}
        selectedDate={selectedDate}
        countsByDate={countsByDate}
        completeDates={completeDates}
        onSelectDate={selectDate}
        onMonthRangeChange={(from, to) => {
          navigate(buildParams({ from, to, date: selectedDate, occurrenceId: undefined }));
        }}
      />

      {/* day + lessons */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{formatHebrewDate(selectedDate)}</h3>
            <p className="text-xs text-slate-500">{formatGregorianDate(selectedDate)}</p>
          </div>
          {completeDateSet.has(selectedDate) && dayOccurrences.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              כל השיעורים ביום זה הושלמו
            </span>
          )}
        </div>

        {dayOccurrences.length === 0 ? (
          <div className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-slate-600">
            <p>אין שיעורים ביום זה.</p>
            <Link href="/lessons" className="mt-2 inline-block font-medium text-[var(--brand)] hover:underline">
              צרי שיעורים או מופעים
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dayOccurrences.map((o) => {
              const selected = o.id === activeOccurrenceId;
              const complete = o.studentCount > 0 && o.markedCount >= o.studentCount;
              const partial = o.markedCount > 0 && !complete;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectLesson(o.id)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-right transition-all",
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand)]/5 ring-2 ring-[var(--brand)]/30"
                      : "border-stone-100 bg-stone-50/80 hover:border-stone-200 hover:bg-white",
                    complete && !selected && "border-emerald-200 bg-emerald-50/50"
                  )}
                >
                  <div className="font-semibold text-slate-800">{o.subject}</div>
                  <div className="text-xs text-slate-500">{o.teacherName || "ללא מורה"}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        complete ? "text-emerald-700" : partial ? "text-amber-700" : "text-slate-500"
                      )}
                    >
                      {o.markedCount}/{o.studentCount} נרשמו
                    </span>
                    {complete && <span className="text-xs text-emerald-600">✓ הושלם</span>}
                    {partial && <span className="text-xs text-amber-600">בתהליך</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* marking */}
      {activeLesson && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">שלב 3</p>
              <h3 className="text-xl font-semibold text-slate-800">{activeLesson.subject}</h3>
              <p className="text-sm text-slate-500">{activeLesson.teacherName}</p>
              <p className="mt-1 text-xs text-slate-600">
                {markedInLesson}/{lessonStudents.length} תלמידות סומנו
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("present")}>
                {bulkSaving ? "שומר…" : "כולן נוכחות"}
              </Button>
              <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("late")}>
                כולן איחור
              </Button>
              <Button size="sm" variant="secondary" disabled={!canMark || bulkSaving} onClick={() => markAll("absent")}>
                כולן נעדרות
              </Button>
            </div>
          </div>

          {message && (
            <p
              className={cn(
                "mb-4 rounded-lg px-3 py-2 text-sm",
                message.includes("שגיא") || message.includes("אין הרשאה")
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-800"
              )}
            >
              {message}
            </p>
          )}

          {mode === "single" && !studentId && (
            <p className="mb-4 text-sm text-amber-800">בחרי תלמידה בסינון למעלה.</p>
          )}

          {lessonStudents.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-600">אין תלמידות משויכות לשיעור זה.</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={syncing}
                onClick={syncStudents}
              >
                {syncing ? "משייכת…" : "שייך תלמידות אוטומטית לפי כיתה/מסלול"}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                או{" "}
                <Link href="/students" className="text-[var(--brand)] hover:underline">
                  בדקי שיבוצים בתלמידות
                </Link>
              </p>
            </div>
          )}

          <ul className="divide-y divide-stone-100">
            {lessonStudents.map((student, idx) => {
              const k = keyOf(student.id, activeOccurrenceId!);
              return (
                <li
                  key={student.id}
                  className={cn(
                    "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                    idx === 0 && "pt-0"
                  )}
                >
                  <span className="min-w-[8rem] font-medium text-slate-800">{student.full_name}</span>
                  <AttendanceStatusPicker
                    value={draft[k] ?? null}
                    phase={cellPhase[k] ?? "idle"}
                    onPick={(s) => pickStatus(student.id, activeOccurrenceId!, s)}
                  />
                </li>
              );
            })}
          </ul>

          {noteLessonId && lessonStudents.length > 0 && (
            <div className="mt-6 border-t border-stone-100 pt-4">
              <label className="mb-2 block text-sm font-medium text-slate-600">הערה לשיעור</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="min-h-[3rem] flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  placeholder="הערות פנימיות…"
                />
                <Button type="button" size="sm" variant="secondary" disabled={noteSaving} onClick={saveNote}>
                  {noteSaving ? "שומר…" : "שמור הערה"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!activeLesson && dayOccurrences.length > 1 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          יש {dayOccurrences.length} שיעורים ביום זה — בחרי שיעור מהרשימה למעלה.
        </p>
      )}
    </div>
  );
}
