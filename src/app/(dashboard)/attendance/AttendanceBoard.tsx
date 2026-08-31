"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
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
import {
  addDays,
  expandIsoRange,
  formatGregorianDate,
  formatHebrewDate,
  startOfWeekSunday,
  todayIso,
} from "@/lib/dates/hebrew";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { ABSENCE_REASONS, type AbsenceReason } from "@/lib/attendance/reasons";
import { Icon } from "@/components/ui/Icon";
import { PrintButton } from "@/components/ui/PrintButton";
import { AssignStudentToLesson } from "../lessons/AssignStudentToLesson";
import {
  AttendanceStatusPicker,
  type AttendancePickerPhase,
} from "./AttendanceStatusPicker";
import { AttendanceBlankSheet } from "./AttendanceBlankSheet";
import { AddOccurrenceDate } from "./AddOccurrenceDate";
import { AttendanceGapModal, type GapItem } from "./AttendanceGapModal";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { Modal } from "@/components/ui/Modal";

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
  lessonId?: string;
  classes: Option[];
  tracks: Option[];
  specializations: Option[];
  teachers: Option[];
  subjects: string[];
  lessons?: Array<{
    id: string;
    subject: string;
    day_of_week?: number;
    lesson_number?: number;
    period_count?: number;
  }>;
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
  holidayDates?: string[];
  cancelledDates?: string[];
  insightsByStudent?: Record<string, StudentInsight>;
  pastGaps?: GapItem[];
  lessonIdsWithNotes?: string[];
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
  lessonId,
  classes,
  tracks,
  specializations,
  teachers,
  subjects,
  lessons = [],
  allStudents,
  monthOccurrences,
  dayOccurrences: dayOccurrencesProp,
  lessonStudents,
  attendance,
  noteBody = "",
  noteLessonId = null,
  completeDates = [],
  partialDates = [],
  holidayDates = [],
  cancelledDates = [],
  insightsByStudent = {},
  pastGaps = [],
  lessonIdsWithNotes = [],
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
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [gapQueue, setGapQueue] = useState<GapItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(classId || trackId || specializationId || subject || studentId || lessonId)
  );
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
    const hard = pastGaps.filter((g) => !g.gapHandling);
    const soft = pastGaps.filter((g) => g.gapHandling === "in_treatment");
    setGapQueue(hard.length ? hard : soft.slice(0, 1));
  }, [pastGaps]);

  const activeGap = gapQueue[0] ?? null;

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
  const weekWarning = useMemo(() => {
    const today = todayIso();
    const weekStart = startOfWeekSunday(selectedDate);
    const weekDays = expandIsoRange(weekStart, addDays(weekStart, 6));
    const prevStart = addDays(weekStart, -7);
    const prevDays = expandIsoRange(prevStart, addDays(prevStart, 6));
    const occDates = new Set(monthOccurrences.map((o) => o.date));
    const partialSet = new Set(partialDates);
    const completeSet = new Set(completeDates);
    const holidaySet = new Set(holidayDates);

    function incompleteIn(days: string[], onlyPast: boolean) {
      return days.filter((d) => {
        if (onlyPast && d >= today) return false;
        if (holidaySet.has(d)) return false;
        if (!occDates.has(d)) return false;
        return partialSet.has(d) || !completeSet.has(d);
      });
    }

    const thisWeekPartial = weekDays.filter((d) => partialSet.has(d));
    const prevIncomplete = incompleteIn(prevDays, true);
    return { thisWeekPartial, prevIncomplete, weekStart, prevStart };
  }, [selectedDate, monthOccurrences, partialDates, completeDates, holidayDates]);

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
      lessonId: patch.lessonId !== undefined ? patch.lessonId : lessonId,
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("presence.attendance.teacherId");
      if (!teacherId && saved && teachers.some((t) => t.id === saved)) {
        navigate(buildParams({ teacherId: saved, occurrenceId: undefined }));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (teacherId) window.localStorage.setItem("presence.attendance.teacherId", teacherId);
      else window.localStorage.removeItem("presence.attendance.teacherId");
    } catch {
      /* ignore */
    }
  }, [teacherId]);

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
      const n = typeof result.assigned === "number" ? result.assigned : 0;
      const backfilled = typeof result.backfilled === "number" ? result.backfilled : 0;
      if (n > 0 || backfilled > 0) {
        setMessage(
          [
            n > 0 ? `שויכו ${n} תלמידות לשיעור` : null,
            backfilled > 0 ? `עודכן תוקף ל־${backfilled} שיוכים קיימים` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        );
      } else {
        setMessage("לא נמצאו תלמידות לפי כיתה/מסלול. אפשר לשייך תלמידה ידנית למטה.");
      }
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Combobox
          label="תלמידה"
          value={studentId ?? ""}
          onChange={(v) => updateFilter("studentId", v || undefined)}
          options={allStudents.map((s) => ({ value: s.id, label: s.full_name }))}
          emptyLabel="כל התלמידות"
        />
        <Combobox
          label="שיעור"
          value={lessonId ?? ""}
          onChange={(v) => updateFilter("lessonId", v || undefined)}
          options={lessons.map((l) => ({
            value: l.id,
            label: formatLessonOptionLabel(l),
          }))}
          emptyLabel="כל השיעורים"
        />
        <Combobox
          label="כיתה"
          value={classId ?? ""}
          onChange={(v) => updateFilter("classId", v || undefined)}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Combobox
          label="מסלול"
          value={trackId ?? ""}
          onChange={(v) => updateFilter("trackId", v || undefined)}
          options={tracks.map((t) => ({ value: t.id, label: t.name }))}
        />
        <Combobox
          label="התמחות"
          value={specializationId ?? ""}
          onChange={(v) => updateFilter("specializationId", v || undefined)}
          options={specializations.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Combobox
          label="מקצוע"
          value={subject ?? ""}
          onChange={(v) => updateFilter("subject", v || undefined)}
          options={subjects.map((s) => ({ value: s, label: s }))}
        />
      </div>
      <p className="font-caption text-caption text-on-surface-variant">
        הסינון מצמצם את היומן לימים ולשיעורים שתואמים לחיפוש — כולל שיוכים של תלמידה ספציפית.
      </p>
      <p className="font-caption text-caption text-on-surface-variant/70">
        מקלדת: נ/N נוכחת · ע/A איחור · ן/X נעדרה · ↑↓ מעבר
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-stack_lg" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {activeGap && (
        <AttendanceGapModal
          gap={activeGap}
          soft={Boolean(activeGap.gapHandling)}
          onResolved={() => setGapQueue((q) => q.slice(1))}
          onMarkAttendance={(gap) => {
            setGapQueue((q) => q.slice(1));
            navigate(
              buildParams({
                date: gap.date,
                occurrenceId: gap.occurrenceId,
                lessonId: gap.lessonId,
              })
            );
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 font-body-md text-body-md text-on-surface-variant print:hidden">
        <span className={cn(!activeOccurrenceId && "font-bold text-primary")}>
          שלב 1: מורה ותאריך
        </span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(!activeOccurrenceId && "font-bold text-primary")}>
          שלב 2: בחירת שיעור
        </span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(activeOccurrenceId && "font-bold text-primary")}>שלב 3: רישום</span>
      </div>

      {/* Teacher-first strip */}
      <div className="rounded-xl border border-secondary/30 bg-secondary-container/30 p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Combobox
            label="מורה (סינון ראשי)"
            value={teacherId ?? ""}
            onChange={(v) => updateFilter("teacherId", v || undefined)}
            options={teachers.map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel="כל המורות"
          />
          <Combobox
            label="שיעור"
            value={lessonId ?? ""}
            onChange={(v) => updateFilter("lessonId", v || undefined)}
            options={lessons.map((l) => ({
              value: l.id,
              label: formatLessonOptionLabel(l),
            }))}
            emptyLabel="כל השיעורים"
          />
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Icon name="filter_list" className="text-[18px]" />
              {filtersOpen ? "הסתר סינון נוסף" : "סינון נוסף (כיתה / מסלול / …)"}
            </Button>
          </div>
        </div>
      </div>

      {(classId || trackId || specializationId || teacherId || subject || studentId || lessonId) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 print:hidden">
          <p className="font-body-sm text-body-sm text-primary">
            היומן מציג רק שיעורים לפי הסינון הפעיל
            {teacherId
              ? ` · מורה: ${teachers.find((t) => t.id === teacherId)?.name ?? ""}`
              : ""}
            .
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              navigate(
                buildParams({
                  classId: undefined,
                  trackId: undefined,
                  specializationId: undefined,
                  teacherId: undefined,
                  subject: undefined,
                  studentId: undefined,
                  lessonId: undefined,
                  occurrenceId: undefined,
                })
              )
            }
          >
            נקה סינון
          </Button>
        </div>
      )}

      {filtersOpen && (
        <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-tactile-md print:hidden">
          {filtersPanel}
        </div>
      )}

      <div className="print:hidden md:hidden">
        <Button type="button" variant="secondary" className="w-full" onClick={() => setFiltersOpen(true)}>
          <Icon name="filter_list" className="text-[18px]" />
          סינון מלא
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-gutter print:hidden xl:grid-cols-12">
        <section className="order-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-tactile-md xl:order-1 xl:col-span-7">
          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-outline-variant/30 pb-2">
            <h3 className="flex flex-wrap items-center gap-1.5 font-label-md text-label-md text-primary">
              <Icon name="today" className="text-[16px] text-secondary" />
              {formatHebrewDate(selectedDate)}
              <span className="font-caption text-caption text-on-surface-variant">
                ({formatGregorianDate(selectedDate)})
              </span>
            </h3>
            {completeDateSet.has(selectedDate) && dayOccurrences.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-attendance-present/10 px-2 py-0.5 text-caption font-semibold text-attendance-present">
                <Icon name="task_alt" className="text-[12px]" />
                הושלם
              </span>
            )}
          </div>
          {weekWarning.thisWeekPartial.length > 0 && (
            <p className="mb-2 rounded-md bg-attendance-late/10 px-2 py-1 font-caption text-caption text-attendance-late">
              בשבוע זה יש שיעורים שסומנו רק חלקית.
            </p>
          )}
          {weekWarning.prevIncomplete.length > 0 && (
            <p className="mb-2 rounded-md bg-error-container/50 px-2 py-1 font-caption text-caption text-on-error-container">
              לא מולאה נוכחות מלאה לשבוע {formatHebrewDate(weekWarning.prevStart)} –{" "}
              {formatHebrewDate(addDays(weekWarning.prevStart, 6))}.
            </p>
          )}

          {dayOccurrences.length === 0 ? (
            <p className="px-1 py-2 font-caption text-caption text-on-surface-variant">
              {cancelledDates.includes(selectedDate)
                ? "ביטול לימודים — אין שיעורים אוטומטיים ביום זה."
                : holidayDates.includes(selectedDate)
                  ? "יום חופשה — אין לימודים ולא נספרת נוכחות."
                  : "אין שיעורים ביום זה לפי הסינון."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {dayOccurrences.map((o) => {
                const selected = o.id === activeOccurrenceId;
                const complete = o.studentCount > 0 && o.markedCount >= o.studentCount;
                const hasNote = lessonIdsWithNotes.includes(o.lessonId);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectLesson(o.id)}
                    className={cn(
                      "relative flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border px-2 py-1.5 text-right",
                      selected
                        ? "border-secondary bg-secondary-container/40"
                        : "border-outline-variant/50 bg-surface-container-lowest hover:border-secondary/50"
                    )}
                  >
                    <span className="truncate font-label-md text-label-md text-primary">
                      {o.subject}
                      {o.lessonNumber ? ` · ${o.lessonNumber}` : ""}
                    </span>
                    <span className="truncate font-caption text-caption text-on-surface-variant">
                      {o.teacherName || "ללא מורה"}
                    </span>
                    <span className="font-caption text-caption text-on-surface-variant">
                      {o.markedCount}/{o.studentCount}
                      {complete ? " ✓" : ""}
                      {hasNote ? " · הערה" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="order-1 xl:sticky xl:top-14 xl:order-2 xl:col-span-5">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-tactile-md">
            <HebrewMonthCalendar
              compact
              initialMonthIso={monthFrom}
              selectedDate={selectedDate}
              countsByDate={countsByDate}
              completeDates={completeDates}
              partialDates={partialDates}
              holidayDates={holidayDates}
              cancelledDates={cancelledDates}
              onSelectDate={selectDate}
              onMonthRangeChange={(from, to) => {
                navigate(buildParams({ from, to, date: selectedDate, occurrenceId: undefined }));
              }}
            />
          </div>
        </div>
      </div>

      <div className="print:hidden">
      {activeLesson ? (
        <div className="mt-2 flex max-h-[70vh] min-h-[12rem] flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md">
          <div className="sticky top-0 z-10 border-b border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-title-lg text-title-lg text-primary">
                  {activeLesson.subject}
                  {activeLesson.lessonNumber
                    ? ` · שיעור ${activeLesson.lessonNumber}`
                    : ""}
                </h3>
                <div className="mt-1 max-w-[14rem]">
                  <HebrewDateInput
                    name="attendance_sheet_date"
                    value={selectedDate}
                    onChange={(iso) => {
                      if (iso) selectDate(iso);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setNoteModalOpen(true)}
                >
                  <Icon name="edit_note" className="text-[16px]" />
                  {note.trim() ? "הערה ✓" : "הערה"}
                </Button>
                <PrintButton
                  label="דף ריק"
                  documentTitle={`נוכחות-${activeLesson.subject}`}
                  disabled={lessonStudents.length === 0}
                />
                <AddOccurrenceDate lessonId={activeLesson.lessonId} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!canMark || bulkSaving}
                onClick={() => markAll("present")}
                className="rounded-md border border-outline px-2.5 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {bulkSaving ? "שומר…" : "הכל נוכח"}
              </button>
              <button
                type="button"
                disabled={!canMark || bulkSaving || unmarkedCount === 0}
                onClick={markRestAbsent}
                className="rounded-md border border-outline px-2.5 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                שאר חסר
              </button>
              <button
                type="button"
                disabled={!canMark || copying}
                onClick={copyPrevious}
                className="rounded-md border border-outline px-2.5 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {copying ? "מעתיק…" : "העתק קודם"}
              </button>
              <span className="ms-auto font-caption text-caption text-on-surface-variant">
                {markedInLesson}/{lessonStudents.length}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {message && (
              <p
                className={cn(
                  "mb-2 rounded-lg px-3 py-1.5 font-body-sm text-body-sm",
                  message.includes("שגיא") || message.includes("אין הרשאה")
                    ? "bg-error-container/60 text-on-error-container"
                    : "bg-attendance-present/10 text-attendance-present"
                )}
              >
                {message}
              </p>
            )}

            {mode === "single" && !studentId && (
              <p className="mb-2 font-body-sm text-body-sm text-attendance-late">
                בחרי תלמידה בסינון.
              </p>
            )}

            {lessonStudents.length === 0 && (
              <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-3 py-4 text-center">
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  אין תלמידות משויכות לשיעור זה.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={syncing}
                  onClick={syncStudents}
                >
                  <Icon name="group_add" className="text-[16px]" />
                  {syncing ? "משייכת…" : "שייך אוטומטית"}
                </Button>
                {activeLesson && (
                  <div className="mx-auto mt-3 max-w-md text-right">
                    <AssignStudentToLesson
                      lessonId={activeLesson.lessonId}
                      students={allStudents}
                      defaultStartDate={selectedDate}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {lessonStudents.map((student, idx) => {
                const k = keyOf(student.id, activeOccurrenceId!);
                const marked = draft[k] != null;
                const focused = focusedIdx === idx;
                const absent = draft[k] === "absent";

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
                      "flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 outline-none transition-colors",
                      absent
                        ? "border-outline-variant/50 border-s-4 border-s-attendance-absent bg-error-container/10"
                        : "border-outline-variant/40 bg-surface-container-lowest hover:border-secondary/40",
                      !marked && !absent && "opacity-90",
                      focused && "ring-2 ring-secondary/40"
                    )}
                  >
                    <span className="min-w-[7rem] flex-1 truncate font-label-md text-label-md text-on-surface">
                      {student.full_name}
                    </span>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                      <AttendanceStatusPicker
                        value={draft[k] ?? null}
                        phase={cellPhase[k] ?? "idle"}
                        onPick={(s) => pickStatus(student.id, activeOccurrenceId!, s, reasons[k])}
                      />
                      {draft[k] === "absent" && (
                        <select
                          className="min-w-[10rem] rounded-md border border-outline-variant/60 bg-surface-container-lowest px-2 py-1 font-body-sm text-body-sm text-on-surface focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/30"
                          value={reasons[k] ?? ""}
                          onChange={(e) =>
                            setReason(
                              student.id,
                              activeOccurrenceId!,
                              e.target.value as AbsenceReason | ""
                            )
                          }
                        >
                          <option value="">הערה (אופציונלי)</option>
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

            {activeLesson && lessonStudents.length > 0 && (
              <div className="mt-2">
                <AssignStudentToLesson
                  lessonId={activeLesson.lessonId}
                  students={allStudents}
                  defaultStartDate={selectedDate}
                />
              </div>
            )}
          </div>
          <div className="mt-auto flex justify-end gap-2 border-t border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
            <button
              type="button"
              onClick={() => navigate(buildParams({ occurrenceId: undefined }))}
              className="rounded-lg border border-outline px-4 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
            >
              סגור
            </button>
            <span className="rounded-lg bg-primary px-4 py-1.5 font-label-md text-label-md text-white shadow-tactile-sm">
              {markedInLesson}/{lessonStudents.length}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex h-8 w-28 items-center justify-center rounded-md border border-dashed border-outline-variant/60 bg-surface-container-lowest px-2 text-center font-caption text-caption text-on-surface-variant">
          בחרי שיעור
        </div>
      )}
      </div>

      {activeLesson && (
        <AttendanceBlankSheet
          subject={activeLesson.subject}
          teacherName={activeLesson.teacherName}
          date={selectedDate}
          students={lessonStudents}
        />
      )}

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

      <Modal
        open={noteModalOpen && Boolean(noteLessonId)}
        title="הערה לשיעור"
        description={activeLesson ? activeLesson.subject : undefined}
        onClose={() => setNoteModalOpen(false)}
      >
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
            placeholder="הערה שנשמרת על השיעור ומוצגת בכל המופעים שלו…"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNoteModalOpen(false)}>
              סגור
            </Button>
            <Button
              type="button"
              disabled={noteSaving}
              onClick={async () => {
                await saveNote();
                setNoteModalOpen(false);
              }}
            >
              {noteSaving ? "שומר…" : "שמור"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
