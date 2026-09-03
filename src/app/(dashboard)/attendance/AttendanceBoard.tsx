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
  buildHebrewMonth,
  expandIsoRange,
  formatGregorianDate,
  formatHebrewDate,
  hebrewMonthFromIso,
  startOfWeekSunday,
} from "@/lib/dates/hebrew";
import { formatLessonHours, formatLessonOptionLabel } from "@/lib/lessons/hours";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
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
  periodCount?: number;
  groupLabel?: string;
  studentCount: number;
  markedCount: number;
  linkedOccurrenceIds?: string[];
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
    teacherId?: string;
    teacherName?: string;
    groupLabel?: string;
    day_of_week?: number;
    lesson_number?: number;
    period_count?: number;
  }>;
  allStudents: AttendanceStudent[];
  monthOccurrences: Array<{ id: string; date: string }>;
  dayOccurrences: DayLessonRow[];
  selectedLessonOccurrences?: Array<{
    id: string;
    date: string;
    studentCount: number;
    markedCount: number;
  }>;
  prevWeekBlocked?: boolean;
  prevWeekIncomplete?: Array<{ id: string; date: string }>;
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

function linkedOccurrenceIds(row: DayLessonRow | undefined, fallbackId?: string): string[] {
  if (row?.linkedOccurrenceIds?.length) return row.linkedOccurrenceIds;
  if (fallbackId) return [fallbackId];
  return row?.id ? [row.id] : [];
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
  selectedLessonOccurrences = [],
  prevWeekBlocked = false,
  prevWeekIncomplete = [],
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
    const linked = linkedOccurrenceIds(
      dayOccurrences.find((o) => o.id === activeOccurrenceId),
      activeOccurrenceId
    );
    const byKey = new Map<string, { status: AttendanceStatus; reason: AbsenceReason | null }>();
    for (const a of attendance) {
      if (!linked.includes(a.lesson_occurrence_id)) continue;
      const k = keyOf(a.student_id, activeOccurrenceId);
      if (!byKey.has(k) || a.lesson_occurrence_id === activeOccurrenceId) {
        byKey.set(k, {
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
  }, [lessonStudents, attendance, activeOccurrenceId, dayOccurrences]);

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
    const weekStart = startOfWeekSunday(selectedDate);
    const weekDays = expandIsoRange(weekStart, addDays(weekStart, 6));
    const thisWeekPartial = weekDays.filter((d) => partialDates.includes(d));
    return { thisWeekPartial };
  }, [selectedDate, partialDates]);

  const teacherLessonOptions = useMemo(() => {
    return lessons
      .filter((l) => l.teacherId && l.teacherName)
      .slice()
      .sort((a, b) => {
        const byTeacher = (a.teacherName ?? "").localeCompare(b.teacherName ?? "", "he");
        if (byTeacher) return byTeacher;
        return a.subject.localeCompare(b.subject, "he");
      })
      .map((l) => {
        const day =
          l.day_of_week != null ? `יום ${DAY_OF_WEEK_LABELS[l.day_of_week] ?? ""}` : "";
        const hours = l.lesson_number
          ? formatLessonHours(l.lesson_number, l.period_count ?? 1)
          : "";
        const group = l.groupLabel || "ללא קבוצה";
        return {
          value: l.id,
          label: `${l.teacherName} · ${l.subject}`,
          description: [group, day, hours].filter(Boolean).join(" · "),
          selectedLabel: [l.teacherName, l.subject, group].filter(Boolean).join(" · "),
          keywords: [l.teacherName, l.subject, group, day, hours].filter(Boolean).join(" "),
        };
      });
  }, [lessons]);

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

  function selectOccurrence(occurrenceId: string, date: string) {
    const seed = hebrewMonthFromIso(date);
    const month = buildHebrewMonth(seed.year, seed.month);
    navigate(
      buildParams({
        date,
        from: month.rangeStart,
        to: month.rangeEnd,
        occurrenceId,
        lessonId: lessonId ?? undefined,
      })
    );
  }

  function updateFilter(key: string, value: string | undefined) {
    navigate(buildParams({ [key]: value, occurrenceId: undefined }));
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("presence.attendance.lessonId");
      const match = saved ? lessons.find((l) => l.id === saved && l.teacherId) : undefined;
      if (!lessonId && match?.teacherId) {
        navigate(
          buildParams({
            teacherId: match.teacherId,
            lessonId: match.id,
            occurrenceId: undefined,
          })
        );
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (lessonId) window.localStorage.setItem("presence.attendance.lessonId", lessonId);
      else window.localStorage.removeItem("presence.attendance.lessonId");
    } catch {
      /* ignore */
    }
  }, [lessonId]);

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

      if (prevWeekBlocked) {
        setMessage("יש להשלים קודם את נוכחות השבוע הקודם של השיעור הזה.");
        return;
      }

      setDraft((prev) => ({ ...prev, [k]: status }));
      if (status !== "absent") {
        setReasons((prev) => ({ ...prev, [k]: null }));
      }
      setCellPhase((prev) => ({ ...prev, [k]: "saving" }));
      setMessage(null);

      if (prevWeekBlocked) {
        setMessage("יש להשלים קודם את נוכחות השבוע הקודם של השיעור הזה.");
        return;
      }

      if (previous === null) bumpMarkedCount(occurrenceId, 1);

      const block = dayOccurrences.find(
        (o) => o.id === occurrenceId || o.linkedOccurrenceIds?.includes(occurrenceId)
      );
      const ids = linkedOccurrenceIds(block, occurrenceId);
      const result =
        ids.length > 1
          ? await bulkAttendanceAction(
              ids.map((id) => ({
                studentId: sid,
                occurrenceId: id,
                status,
                reason: status === "absent" ? reason ?? null : null,
              }))
            )
          : await upsertAttendanceAction(
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
    [draft, reasons, lessonStudents, dayOccurrences, prevWeekBlocked]
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

    const ids = linkedOccurrenceIds(activeLesson, activeOccurrenceId);
    const updates = lessonStudents.flatMap((s) =>
      ids.map((occurrenceId) => ({
        studentId: s.id,
        occurrenceId,
        status,
      }))
    );

    const next = { ...draft };
    for (const s of lessonStudents) {
      next[keyOf(s.id, activeOccurrenceId)] = status;
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
      setMessage(`נשמר — ${lessonStudents.length} תלמידות`);
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
    const ids = linkedOccurrenceIds(activeLesson, activeOccurrenceId);
    const updates = unmarked.flatMap((s) =>
      ids.map((occurrenceId) => ({
        studentId: s.id,
        occurrenceId,
        status: "absent" as const,
      }))
    );
    const next = { ...draft };
    for (const s of unmarked) next[keyOf(s.id, activeOccurrenceId)] = "absent";
    setDraft(next);
    setDayOccurrences((prev) =>
      prev.map((o) =>
        o.id === activeOccurrenceId
          ? { ...o, markedCount: Math.min(o.studentCount, o.markedCount + unmarked.length) }
          : o
      )
    );
    const result = await bulkAttendanceAction(updates);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      router.refresh();
    } else {
      setMessage(`סומנו ${unmarked.length} נעדרות (מי שלא סומנה)`);
    }
    setBulkSaving(false);
  }

  async function copyPrevious() {
    if (!activeOccurrenceId) return;
    setCopying(true);
    setMessage(null);
    const result = await copyPreviousAttendanceAction(
      activeOccurrenceId,
      linkedOccurrenceIds(activeLesson, activeOccurrenceId)
    );
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
    const ids = linkedOccurrenceIds(
      dayOccurrences.find((o) => o.id === occurrenceId || o.linkedOccurrenceIds?.includes(occurrenceId)),
      occurrenceId
    );
    if (ids.length > 1) {
      await bulkAttendanceAction(
        ids.map((id) => ({
          studentId: sid,
          occurrenceId: id,
          status: "absent" as const,
          reason: nextReason,
        }))
      );
    } else {
      await upsertAttendanceAction(sid, occurrenceId, "absent", nextReason);
    }
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

  const canMark =
    Boolean(activeOccurrenceId) && lessonStudents.length > 0 && !prevWeekBlocked;
  const markedInLesson = activeOccurrenceId
    ? Object.keys(draft).filter(
        (k) => k.endsWith(`::${activeOccurrenceId}`) && draft[k] !== null
      ).length
    : 0;
  const unmarkedCount = Math.max(0, lessonStudents.length - markedInLesson);

  const selectedLessonMeta = lessons.find((l) => l.id === lessonId);

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
        <span className={cn(!lessonId && "font-bold text-primary")}>שלב 1: מורה ושיעור</span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(Boolean(lessonId && !activeOccurrenceId) && "font-bold text-primary")}>
          שלב 2: מופע
        </span>
        <Icon name="arrow_back" className="text-[16px]" />
        <span className={cn(Boolean(activeOccurrenceId) && "font-bold text-primary")}>
          שלב 3: רישום
        </span>
      </div>

      <div className="rounded-xl border border-secondary/30 bg-secondary-container/30 p-4 print:hidden">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Combobox
              label="מורה ושיעור"
              value={lessonId ?? ""}
              onChange={(v) => {
                const picked = lessons.find((l) => l.id === v);
                navigate(
                  buildParams({
                    teacherId: picked?.teacherId || undefined,
                    lessonId: v || undefined,
                    occurrenceId: undefined,
                  })
                );
              }}
              options={teacherLessonOptions}
              emptyLabel="בחרי מורה ושיעור"
              maxSuggestions={24}
            />
          </div>
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
        <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
          רק מורות עם שיעורים בשנה הפעילה. אותה מורה יכולה להופיע כמה פעמים — ליד כל שורה כתובים השיעור והקבוצה.
        </p>
      </div>

      {(classId || trackId || specializationId || teacherId || subject || studentId || lessonId) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 print:hidden">
          <p className="font-body-sm text-body-sm text-primary">
            היומן מציג רק שיעורים לפי הסינון הפעיל
            {selectedLessonMeta?.teacherName
              ? ` · ${selectedLessonMeta.teacherName}`
              : teacherId
                ? ` · מורה: ${teachers.find((t) => t.id === teacherId)?.name ?? ""}`
                : ""}
            {selectedLessonMeta?.subject ? ` · ${selectedLessonMeta.subject}` : ""}
            {selectedLessonMeta?.groupLabel ? ` · ${selectedLessonMeta.groupLabel}` : ""}
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
          {lessonId && selectedLessonOccurrences.length > 0 && (
            <div className="mb-3 rounded-md border border-outline-variant/40 bg-surface-container-low/40 p-2">
              <p className="mb-1 font-label-md text-label-md text-primary">
                מופעים של {selectedLessonMeta?.subject ?? "השיעור"}
                {selectedLessonMeta?.groupLabel ? ` · ${selectedLessonMeta.groupLabel}` : ""}
              </p>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {selectedLessonOccurrences.map((o) => {
                  const complete = o.studentCount > 0 && o.markedCount >= o.studentCount;
                  const selected = o.id === activeOccurrenceId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => selectOccurrence(o.id, o.date)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-right",
                        selected
                          ? "border-secondary bg-secondary-container/40"
                          : "border-outline-variant/40 hover:border-secondary/50"
                      )}
                    >
                      <span className="font-body-sm text-body-sm text-on-surface">
                        {formatHebrewDate(o.date)}
                        <span className="ms-1 font-caption text-caption text-on-surface-variant">
                          ({formatGregorianDate(o.date)})
                        </span>
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant">
                        {o.markedCount}/{o.studentCount}
                        {complete ? " ✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          {prevWeekBlocked && (
            <div className="mb-2 rounded-md bg-error-container/70 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
              <p className="font-semibold">לא ניתן לסמן נוכחות למופע זה עדיין.</p>
              <p className="mt-1">
                יש להשלים קודם את נוכחות השבוע הקודם של השיעור הזה
                {prevWeekIncomplete[0]
                  ? ` (${formatHebrewDate(prevWeekIncomplete[0].date)}).`
                  : "."}
              </p>
              {prevWeekIncomplete[0] && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    selectOccurrence(prevWeekIncomplete[0].id, prevWeekIncomplete[0].date)
                  }
                >
                  עבור למופע שחסר
                </Button>
              )}
            </div>
          )}
          {weekWarning.thisWeekPartial.length > 0 && (
            <p className="mb-2 rounded-md bg-attendance-late/10 px-2 py-1 font-caption text-caption text-attendance-late">
              בשבוע זה יש שיעורים שסומנו רק חלקית.
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
                const selected =
                  o.id === activeOccurrenceId ||
                  Boolean(activeOccurrenceId && o.linkedOccurrenceIds?.includes(activeOccurrenceId));
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
                      {o.lessonNumber
                        ? ` · ${formatLessonHours(o.lessonNumber, o.periodCount ?? 1)}`
                        : ""}
                    </span>
                    <span className="line-clamp-2 font-caption text-caption text-on-surface-variant">
                      {o.teacherName || "ללא מורה"}
                      {o.groupLabel ? ` · ${o.groupLabel}` : ""}
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
                <p className="font-caption text-caption text-on-surface-variant">מסמנים נוכחות עבור</p>
                <h3 className="truncate font-title-lg text-title-lg text-primary">
                  {activeLesson.subject}
                </h3>
                <dl className="mt-1 grid gap-0.5 font-body-md text-body-md text-on-surface">
                  <div>
                    <span className="text-on-surface-variant">קבוצה: </span>
                    {activeLesson.groupLabel || "—"}
                  </div>
                  <div>
                    <span className="text-on-surface-variant">מורה: </span>
                    {activeLesson.teacherName || "ללא מורה"}
                  </div>
                  <div>
                    <span className="text-on-surface-variant">תאריך: </span>
                    {formatHebrewDate(selectedDate)}
                    {activeLesson.lessonNumber
                      ? ` · ${formatLessonHours(activeLesson.lessonNumber, activeLesson.periodCount ?? 1)}`
                      : ""}
                  </div>
                </dl>
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
                        disabled={prevWeekBlocked}
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
          groupLabel={activeLesson.groupLabel}
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
