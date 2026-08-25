"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewMonthCalendar } from "@/components/ui/HebrewMonthCalendar";
import {
  bulkAttendanceAction,
  copyPreviousAttendanceAction,
  syncLessonStudentsAction,
  upsertAttendanceAction,
  upsertAttendanceNoteAction,
} from "../actions";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";
import { ABSENCE_REASONS, type AbsenceReason } from "@/lib/attendance/reasons";
import { Icon } from "@/components/ui/Icon";
import {
  AttendanceStatusPicker,
  type AttendancePickerPhase,
} from "./AttendanceStatusPicker";

export type AttendanceMode = "single" | "group";

export interface AttendanceStudent {
  id: string;
  full_name: string;
  absencePercent?: number;
  ruleLevel?: "ok" | "warning" | "blocked";
  presentStreak?: number;
}

export interface DayLessonRow {
  id: string;
  date: string;
  subject: string;
  teacherName: string;
  lessonId: string;
  lessonNumber?: number;
  studentCount: number;
  markedCount: number;
}

interface Option {
  id: string;
  name: string;
}

export interface StudentInsight {
  absencePercent: number;
  ruleLevel: "ok" | "warning" | "blocked";
  presentStreak: number;
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
  attendance: {
    student_id: string;
    lesson_occurrence_id: string;
    status: string;
    reason?: string | null;
  }[];
  noteBody?: string;
  noteLessonId?: string | null;
  completeDates?: string[];
  partialDates?: string[];
  insightsByStudent?: Record<string, StudentInsight>;
}

type DraftKey = string;

type UndoItem = {
  studentId: string;
  occurrenceId: string;
  previous: AttendanceStatus | null;
  previousReason: AbsenceReason | null;
  label: string;
};

function keyOf(studentId: string, occurrenceId: string): DraftKey {
  return `${studentId}::${occurrenceId}`;
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
  partialDates = [],
  insightsByStudent = {},
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<DraftKey, AttendanceStatus | null>>({});
  const [reasons, setReasons] = useState<Record<DraftKey, AbsenceReason | null>>({});
  const [cellPhase, setCellPhase] = useState<Record<DraftKey, AttendancePickerPhase>>({});
  const [dayOccurrences, setDayOccurrences] = useState(dayOccurrencesProp);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState(noteBody);
  const [noteSaving, setNoteSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [undo, setUndo] = useState<UndoItem | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => {
    setDayOccurrences(dayOccurrencesProp);
  }, [dayOccurrencesProp]);

  const activeOccurrenceId =
    selectedOccurrenceId && dayOccurrences.some((o) => o.id === selectedOccurrenceId)
      ? selectedOccurrenceId
      : undefined;

  const activeLesson = dayOccurrences.find((o) => o.id === activeOccurrenceId);

  useEffect(() => {
    setNote(noteBody);
  }, [noteBody]);

  useEffect(() => {
    if (!activeOccurrenceId) {
      setDraft({});
      setReasons({});
      return;
    }
    const byKey = new Map<string, { status: AttendanceStatus; reason: AbsenceReason | null }>();
    for (const a of attendance) {
      if (a.lesson_occurrence_id === activeOccurrenceId) {
        byKey.set(keyOf(a.student_id, a.lesson_occurrence_id), {
          status: a.status as AttendanceStatus,
          reason: (a.reason as AbsenceReason | null) ?? null,
        });
      }
    }
    const nextDraft: Record<DraftKey, AttendanceStatus | null> = {};
    const nextReasons: Record<DraftKey, AbsenceReason | null> = {};
    for (const student of lessonStudents) {
      const k = keyOf(student.id, activeOccurrenceId);
      const row = byKey.get(k);
      nextDraft[k] = row?.status ?? null;
      nextReasons[k] = row?.reason ?? null;
    }
    setDraft(nextDraft);
    setReasons(nextReasons);
    setCellPhase({});
    setMessage(null);

    const firstUnmarked = lessonStudents.findIndex((s) => !byKey.has(keyOf(s.id, activeOccurrenceId)));
    setFocusedIdx(firstUnmarked >= 0 ? firstUnmarked : 0);
  }, [lessonStudents, attendance, activeOccurrenceId]);

  useEffect(() => {
    if (dayOccurrences.length === 1 && !selectedOccurrenceId) {
      const params = buildParams({ occurrenceId: dayOccurrences[0].id });
      router.replace(`/attendance?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOccurrences.length, selectedOccurrenceId, selectedDate]);

  useEffect(() => {
    const el = rowRefs.current[focusedIdx];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.focus();
  }, [focusedIdx, activeOccurrenceId]);

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

  function showUndo(item: UndoItem) {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setUndo(item);
    undoTimer.current = window.setTimeout(() => setUndo(null), 3500);
  }

  const pickStatus = useCallback(
    async (
      sid: string,
      occurrenceId: string,
      status: AttendanceStatus,
      reason?: AbsenceReason | null
    ) => {
      const k = keyOf(sid, occurrenceId);
      const previous = draft[k] ?? null;
      const previousReason = reasons[k] ?? null;
      const studentName = lessonStudents.find((s) => s.id === sid)?.full_name ?? "";

      setDraft((prev) => ({ ...prev, [k]: status }));
      if (status !== "absent") {
        setReasons((prev) => ({ ...prev, [k]: null }));
      }
      setCellPhase((prev) => ({ ...prev, [k]: "saving" }));
      setMessage(null);

      if (previous === null) bumpMarkedCount(occurrenceId, 1);

      const result = await upsertAttendanceAction(
        sid,
        occurrenceId,
        status,
        status === "absent" ? reason ?? null : null
      );
      if (result && "error" in result && result.error) {
        if (previous === null) bumpMarkedCount(occurrenceId, -1);
        setDraft((prev) => ({ ...prev, [k]: previous }));
        setReasons((prev) => ({ ...prev, [k]: previousReason }));
        setCellPhase((prev) => ({ ...prev, [k]: "error" }));
        setMessage(result.error);
        window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 2000);
        return;
      }

      setCellPhase((prev) => ({ ...prev, [k]: "saved" }));
      window.setTimeout(() => setCellPhase((prev) => ({ ...prev, [k]: "idle" })), 900);
      showUndo({
        studentId: sid,
        occurrenceId,
        previous,
        previousReason,
        label: studentName,
      });

      const idx = lessonStudents.findIndex((s) => s.id === sid);
      if (idx >= 0 && idx < lessonStudents.length - 1) {
        setFocusedIdx(idx + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, reasons, lessonStudents]
  );

  async function undoLast() {
    if (!undo) return;
    const item = undo;
    setUndo(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);

    if (item.previous === null) {
      // cannot delete via upsert easily — restore by not marking; re-set previous if any
      // For null previous we leave as-is unless user wants clear; skip delete for safety
      setMessage("לא ניתן לבטל סימון ראשון — שנו לסטטוס אחר");
      return;
    }

    await pickStatus(item.studentId, item.occurrenceId, item.previous, item.previousReason);
    setMessage(`בוטל עבור ${item.label}`);
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

  async function markRestAbsent() {
    if (!activeOccurrenceId) return;
    const unmarked = lessonStudents.filter(
      (s) => draft[keyOf(s.id, activeOccurrenceId)] == null
    );
    if (unmarked.length === 0) {
      setMessage("כל התלמידות כבר סומנו");
      return;
    }
    setBulkSaving(true);
    const updates = unmarked.map((s) => ({
      studentId: s.id,
      occurrenceId: activeOccurrenceId,
      status: "absent" as const,
    }));
    const next = { ...draft };
    for (const u of updates) next[keyOf(u.studentId, u.occurrenceId)] = "absent";
    setDraft(next);
    setDayOccurrences((prev) =>
      prev.map((o) =>
        o.id === activeOccurrenceId
          ? { ...o, markedCount: Math.min(o.studentCount, o.markedCount + updates.length) }
          : o
      )
    );
    const result = await bulkAttendanceAction(updates);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      router.refresh();
    } else {
      setMessage(`סומנו ${updates.length} נעדרות (מי שלא סומנה)`);
    }
    setBulkSaving(false);
  }

  async function copyPrevious() {
    if (!activeOccurrenceId) return;
    setCopying(true);
    setMessage(null);
    const result = await copyPreviousAttendanceAction(activeOccurrenceId);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
    } else if (result && "copied" in result) {
      setMessage(`הועתקו ${result.copied} רישומים מהשיעור הקודם`);
      router.refresh();
    }
    setCopying(false);
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

  async function setReason(sid: string, occurrenceId: string, reason: AbsenceReason | "") {
    const k = keyOf(sid, occurrenceId);
    const status = draft[k];
    if (status !== "absent") return;
    const nextReason = reason || null;
    setReasons((prev) => ({ ...prev, [k]: nextReason }));
    await upsertAttendanceAction(sid, occurrenceId, "absent", nextReason);
  }

  function onRowKeyDown(e: React.KeyboardEvent, idx: number) {
    if (!activeOccurrenceId) return;
    const student = lessonStudents[idx];
    if (!student) return;
    const key = e.key.toLowerCase();

    if (key === "n" || key === "נ") {
      e.preventDefault();
      void pickStatus(student.id, activeOccurrenceId, "present");
    } else if (key === "a" || key === "ע") {
      e.preventDefault();
      void pickStatus(student.id, activeOccurrenceId, "late");
    } else if (key === "x" || key === "ן") {
      e.preventDefault();
      void pickStatus(student.id, activeOccurrenceId, "absent");
    } else if (key === "arrowdown" || (key === "tab" && !e.shiftKey)) {
      e.preventDefault();
      setFocusedIdx(Math.min(lessonStudents.length - 1, idx + 1));
    } else if (key === "arrowup" || (key === "tab" && e.shiftKey)) {
      e.preventDefault();
      setFocusedIdx(Math.max(0, idx - 1));
    } else if (key === "enter") {
      e.preventDefault();
      const first = lessonStudents.findIndex(
        (s) => draft[keyOf(s.id, activeOccurrenceId)] == null
      );
      if (first >= 0) setFocusedIdx(first);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || mode !== "single" || allStudents.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 60) return;

    const ids = allStudents.map((s) => s.id);
    const cur = studentId ? ids.indexOf(studentId) : -1;
    if (cur < 0) return;
    // RTL: swipe right (positive delta) = previous, left = next
    const nextIdx = delta > 0 ? cur - 1 : cur + 1;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    updateFilter("studentId", ids[nextIdx]);
  }

  const canMark = Boolean(activeOccurrenceId) && lessonStudents.length > 0;
  const markedInLesson = activeOccurrenceId
    ? Object.keys(draft).filter(
        (k) => k.endsWith(`::${activeOccurrenceId}`) && draft[k] !== null
      ).length
    : 0;
  const unmarkedCount = Math.max(0, lessonStudents.length - markedInLesson);

  const filtersPanel = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
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
              "rounded-lg px-3 py-1.5 font-label-md text-label-md transition-colors",
              mode === value
                ? "bg-primary text-on-primary shadow-tactile-sm"
                : "bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/40 hover:bg-surface-container"
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
      <p className="font-caption text-caption text-on-surface-variant/70">
        מקלדת: נ/N נוכחת · ע/A איחור · ן/X נעדרה · ↑↓ מעבר
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-stack_lg" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex flex-wrap items-center gap-2 font-body-md text-body-md text-on-surface-variant">
        <span className={cn(!activeOccurrenceId && "font-bold text-primary")}>
          שלב 1: בחירת תאריך
        </span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(!activeOccurrenceId && "font-bold text-primary")}>
          שלב 2: בחירת שיעור
        </span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(activeOccurrenceId && "font-bold text-primary")}>שלב 3: רישום</span>
      </div>

      {/* desktop filters */}
      <div className="hidden overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md md:block">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-low/60"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Icon name="filter_list" className="text-secondary" />
            סינון (כיתה, מורה, מקצוע…)
          </span>
          <Icon
            name="expand_more"
            className={cn(
              "text-on-surface-variant transition-transform",
              filtersOpen && "rotate-180"
            )}
          />
        </button>
        {filtersOpen && (
          <div className="border-t border-outline-variant/30 px-4 pb-4 pt-4">{filtersPanel}</div>
        )}
      </div>

      {/* mobile filter sheet trigger */}
      <div className="md:hidden">
        <Button type="button" variant="secondary" className="w-full" onClick={() => setFiltersOpen(true)}>
          <Icon name="filter_list" className="text-[18px]" />
          סינון ומצב רישום
        </Button>
        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-primary/40" role="dialog">
            <button
              type="button"
              className="flex-1"
              aria-label="סגור"
              onClick={() => setFiltersOpen(false)}
            />
            <div className="max-h-[80vh] overflow-y-auto rounded-t-3xl bg-surface-container-lowest p-5 shadow-tactile-lg">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-title-lg text-title-lg text-primary">סינון</h3>
                <Button type="button" size="sm" variant="secondary" onClick={() => setFiltersOpen(false)}>
                  סגור
                </Button>
              </div>
              {filtersPanel}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-12">
        <div className="flex flex-col gap-stack_lg xl:col-span-5">
      <HebrewMonthCalendar
        compact
        initialMonthIso={monthFrom}
        selectedDate={selectedDate}
        countsByDate={countsByDate}
        completeDates={completeDates}
        partialDates={partialDates}
        onSelectDate={selectDate}
        onMonthRangeChange={(from, to) => {
          navigate(buildParams({ from, to, date: selectedDate, occurrenceId: undefined }));
        }}
      />

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-tactile-md">
            <div className="mb-4 border-b border-outline-variant/30 pb-4">
              <h3 className="flex flex-wrap items-center gap-2 font-title-lg text-title-lg text-primary">
                <Icon name="today" className="text-secondary" />
                {formatHebrewDate(selectedDate)}
                <span className="font-caption text-caption font-semibold text-on-surface-variant">
                  ({formatGregorianDate(selectedDate)})
                </span>
              </h3>
              {completeDateSet.has(selectedDate) && dayOccurrences.length > 0 && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-attendance-present/10 px-3 py-1 text-caption font-semibold text-attendance-present">
                  <Icon name="task_alt" className="text-[14px]" />
                  הושלם
                </span>
              )}
            </div>

            {dayOccurrences.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <Icon name="event_busy" className="mb-2 inline-block text-[36px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  אין שיעורים ביום זה.
                </p>
                <Link
                  href="/lessons"
                  className="mt-3 inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:underline"
                >
                  <Icon name="add" className="text-[16px]" />
                  צרי שיעורים או מופעים
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {dayOccurrences.map((o) => {
                  const selected = o.id === activeOccurrenceId;
                  const complete = o.studentCount > 0 && o.markedCount >= o.studentCount;
                  const pct =
                    o.studentCount > 0 ? Math.round((o.markedCount / o.studentCount) * 100) : 0;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => selectLesson(o.id)}
                      className={cn(
                        "relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-surface-container-lowest p-4 text-right transition-transform hover:-translate-y-0.5",
                        selected
                          ? "border-2 border-secondary shadow-tactile-sm"
                          : "border-outline-variant hover:shadow-tactile-md"
                      )}
                    >
                      {selected && (
                        <span className="absolute left-0 top-0 h-1 w-full bg-secondary" />
                      )}
                      <span
                        className={cn(
                          "self-start rounded-md px-2 py-0.5 font-label-md text-label-md",
                          selected
                            ? "bg-secondary-container text-secondary"
                            : "bg-surface-variant text-on-surface-variant"
                        )}
                      >
                        שיעור {o.lessonNumber || "—"}
                      </span>
                      <h4 className="mt-1 font-title-lg text-title-lg text-primary">{o.subject}</h4>
                      <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                        <Icon name="person" className="text-[16px]" />
                        {o.teacherName ? `המורה ${o.teacherName}` : "ללא מורה"}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-surface-variant">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            complete ? "bg-attendance-present" : "bg-secondary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-caption text-caption text-on-surface-variant">
                        {o.markedCount}/{o.studentCount} רשומים
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="xl:col-span-7">
      {activeLesson ? (
        <div className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md xl:h-[800px]">
          <div className="sticky top-0 z-10 border-b border-outline-variant/30 bg-surface-container-lowest p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-headline-md text-headline-md text-primary">
                  {activeLesson.subject}
                  {activeLesson.lessonNumber
                    ? ` - שיעור ${activeLesson.lessonNumber}`
                    : ""}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {formatHebrewDate(selectedDate)}
                  {activeLesson.teacherName ? ` • המורה ${activeLesson.teacherName}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={syncing}
                onClick={syncStudents}
              >
                <Icon name="sync" className="text-[18px]" />
                {syncing ? "מסנכרן…" : "סנכרון נתונים"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canMark || bulkSaving}
                  onClick={() => markAll("present")}
                  className="rounded-md border border-outline px-3 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  {bulkSaving ? "שומר…" : "סמן הכל נוכח"}
                </button>
                <button
                  type="button"
                  disabled={!canMark || bulkSaving || unmarkedCount === 0}
                  onClick={markRestAbsent}
                  className="rounded-md border border-outline px-3 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  סמן שאר חסר
                </button>
                <button
                  type="button"
                  disabled={!canMark || copying}
                  onClick={copyPrevious}
                  className="rounded-md border border-outline px-3 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  {copying ? "מעתיק…" : "העתק מקודם"}
                </button>
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                קיצורי מקלדת: נוכחת (N) • נעדרה (X) • איחור (A)
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-6">
            {message && (
              <p
                className={cn(
                  "mb-4 rounded-lg px-3 py-2 font-body-sm text-body-sm",
                  message.includes("שגיא") || message.includes("אין הרשאה")
                    ? "bg-error-container/60 text-on-error-container"
                    : "bg-attendance-present/10 text-attendance-present"
                )}
              >
                {message}
              </p>
            )}

            {mode === "single" && !studentId && (
              <p className="mb-4 font-body-sm text-body-sm text-attendance-late">
                בחרי תלמידה בסינון.
              </p>
            )}

            {lessonStudents.length === 0 && (
              <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                <Icon name="group_off" className="mb-2 block text-[36px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  אין תלמידות משויכות לשיעור זה.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={syncing}
                  onClick={syncStudents}
                >
                  <Icon name="group_add" className="text-[18px]" />
                  {syncing ? "משייכת…" : "שייך תלמידות אוטומטית לפי כיתה/מסלול"}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {lessonStudents.map((student, idx) => {
                const k = keyOf(student.id, activeOccurrenceId!);
                const marked = draft[k] != null;
                const insight = insightsByStudent[student.id];
                const focused = focusedIdx === idx;
                const absent = draft[k] === "absent";

                const initial = student.full_name?.[0] ?? "?";
                return (
                  <div
                    key={student.id}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => onRowKeyDown(e, idx)}
                    onFocus={() => setFocusedIdx(idx)}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border p-4 outline-none transition-all sm:flex-row sm:items-center sm:justify-between",
                      absent
                        ? "border-y border-r border-outline-variant/50 border-l-4 border-l-attendance-absent bg-error-container/10"
                        : "border-outline-variant/50 bg-surface-container-lowest hover:border-secondary/50 hover:shadow-tactile-sm",
                      !marked && !absent && "opacity-90",
                      focused && "ring-2 ring-secondary/40"
                    )}
                  >
                    <div className="flex min-w-[10rem] flex-1 items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-caption text-caption font-bold text-white"
                      >
                        {initial}
                      </span>
                      <div className="min-w-0 flex flex-col gap-1">
                          <span className="font-title-lg text-title-lg text-primary">
                            {student.full_name}
                          </span>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {insight && insight.ruleLevel !== "ok" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                insight.ruleLevel === "blocked"
                                  ? "text-attendance-absent"
                                  : "text-attendance-late"
                              )}
                            >
                              <Icon name="warning" className="text-[14px]" />
                              {insight.absencePercent}% היעדרויות
                              {insight.ruleLevel === "blocked" ? " · חריגה" : ""}
                            </span>
                          ) : (
                            "נוכחות תקינה"
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full max-w-md flex-col gap-2">
                      <AttendanceStatusPicker
                        value={draft[k] ?? null}
                        phase={cellPhase[k] ?? "idle"}
                        onPick={(s) => pickStatus(student.id, activeOccurrenceId!, s, reasons[k])}
                      />
                      {draft[k] === "absent" && (
                        <select
                          className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                          value={reasons[k] ?? ""}
                          onChange={(e) =>
                            setReason(
                              student.id,
                              activeOccurrenceId!,
                              e.target.value as AbsenceReason | ""
                            )
                          }
                        >
                          <option value="">סיבת היעדרות (אופציונלי)</option>
                          {ABSENCE_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {noteLessonId && lessonStudents.length > 0 && (
              <div className="mt-6 rounded-xl border-l-4 border-l-primary bg-surface-container-low/60 p-stack_md">
                <label className="mb-2 flex items-center gap-2 font-label-md text-label-md text-primary">
                  <Icon name="edit_note" className="text-secondary" />
                  הערות כלליות לשיעור
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="min-h-[3rem] flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                    placeholder="הקלידי הערות מיוחדות, אירועים חריגים או בקשות הקשורות לשיעור זה…"
                  />
                  <Button type="button" size="sm" disabled={noteSaving} onClick={saveNote}>
                    <Icon name="save" className="text-[18px]" />
                    {noteSaving ? "שומר…" : "שמור הערה"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-auto flex justify-end gap-3 border-t border-outline-variant/30 bg-surface-container-lowest p-6">
            <button
              type="button"
              onClick={() => navigate(buildParams({ occurrenceId: undefined }))}
              className="rounded-lg border border-outline px-6 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
            >
              ביטול
            </button>
            <span className="rounded-lg bg-primary px-6 py-2 font-label-md text-label-md text-white shadow-tactile-sm">
              {markedInLesson}/{lessonStudents.length} נשמרו
            </span>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-6 py-10 text-center shadow-tactile-md">
          <Icon name="touch_app" className="mb-3 text-[36px] text-secondary" />
          <p className="font-title-lg text-title-lg text-primary">בחרי שיעור לרישום</p>
          <p className="mt-1 max-w-sm font-body-md text-body-md text-on-surface-variant">
            שלב 1 ו־2: בחרי תאריך ואז שיעור, והרשימה תופיע כאן.
          </p>
        </div>
      )}
        </div>
      </div>

      {undo && (
        <div className="fixed bottom-8 left-8 z-50 flex items-center gap-4 rounded-lg bg-primary px-6 py-4 font-body-md text-body-md text-on-primary shadow-tactile-lg">
          <Icon name="check_circle" className="text-secondary-fixed" />
          <span>נשמר עבור {undo.label}</span>
          <button
            type="button"
            className="font-label-md text-label-md text-secondary-fixed hover:underline"
            onClick={undoLast}
          >
            בטל
          </button>
        </div>
      )}
    </div>
  );
}
