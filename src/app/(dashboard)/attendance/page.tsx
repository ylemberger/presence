import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  isDateInRange,
  todayIso,
} from "@/lib/dates/hebrew";
import {
  evaluateAbsenceAgainstRule,
  summarizeAttendance,
} from "@/lib/attendance/calculator";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";
import { mergeAttendanceBlocks } from "@/lib/attendance/blocks";
import { holidayDatesByKind } from "@/lib/lessons/holidays";
import { audienceForLesson, lessonMatchesAudienceFilter } from "@/lib/lessons/autoAssign";
import { audienceKey } from "@/lib/lessons/group-label";
import { calcUnitForLesson } from "@/lib/attendance/pools";
import {
  blockingPreviousWeekGaps,
  findIncompletePreviousWeekOccurrences,
} from "@/lib/attendance/previous-week";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
import { loadAttendanceShell, type ShellLesson, type ShellStudent } from "@/lib/attendance/load-shell";
import { bustAttendanceShellCache } from "@/lib/attendance/shell-cache";
import {
  fetchAttendanceForOccurrences,
  fetchSkinnyOccurrences,
} from "@/lib/attendance/load-occurrences";
import { embedOne } from "@/lib/supabase/embed";
import { fetchAssignmentsByLessons } from "@/lib/supabase/paged";
import { compareStudentsByLastName } from "@/lib/students/sort";
import {
  AttendanceBoard,
  type AttendanceMode,
  type StudentInsight,
} from "./AttendanceBoard";

interface Props {
  searchParams: {
    date?: string;
    from?: string;
    to?: string;
    occurrenceId?: string;
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    lessonId?: string;
    mode?: string;
  };
}

export default async function AttendancePage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title="נוכחות"
          description="יש להגדיר שנה אקדמית פעילה."
          size="headline"
        />
      </div>
    );
  }

  const mode: AttendanceMode = params.mode === "single" ? "single" : "group";
  const selectedDate = params.date || todayIso();
  const monthSeed = hebrewMonthFromIso(params.from || selectedDate);
  const month = buildHebrewMonth(monthSeed.year, monthSeed.month);
  const monthFrom = params.from || month.rangeStart;
  const monthTo = params.to || month.rangeEnd;

  const [shell, pendingSummary, studentLinks] = await Promise.all([
    loadAttendanceShell(activeYear.id),
    getPendingAttendanceSummary(activeYear.id),
    params.studentId
      ? supabase
          .from("student_lesson_assignments")
          .select("lesson_id, start_date, end_date")
          .eq("student_id", params.studentId)
      : Promise.resolve({ data: [] as { lesson_id: string; start_date: string; end_date: string | null }[] }),
  ]);

  const yearLessonIds = shell.lessons.map((l) => l.id);
  const rawOccs = await fetchSkinnyOccurrences(supabase, {
    yearLessonIds,
    lessonId: params.lessonId,
    fromDate: params.lessonId ? undefined : monthFrom,
    toDate: params.lessonId ? undefined : monthTo,
    includeCancelled: Boolean(params.lessonId),
  });

  let lessonById = new Map(shell.lessons.map((l) => [l.id, l]));
  if (rawOccs.some((o) => !lessonById.has(o.lesson_id))) {
    bustAttendanceShellCache();
    const fresh = await loadAttendanceShell(activeYear.id);
    Object.assign(shell, fresh);
    lessonById = new Map(fresh.lessons.map((l) => [l.id, l]));
  }

  const audienceByLesson = shell.audienceByLesson;
  const poolCatalog = shell.poolCatalog;
  const catalog = shell.catalog;

  type MappedOcc = {
    id: string;
    date: string;
    status: string;
    subject: string;
    subjectId: string;
    lessonNumber: number;
    periodCount: number;
    teacherName: string;
    teacherId: string;
    lessonId: string;
    classId: string | null;
    trackId: string | null;
    specializationId: string | null;
    attendanceRuleId: string | null;
    groupLabel: string;
    calcUnitKey: string;
    audienceKey: string;
  };

  function mapOccurrence(o: (typeof rawOccs)[number], lesson: ShellLesson): MappedOcc {
    const audience = audienceForLesson(
      {
        id: lesson.id,
        grade_id: lesson.gradeId,
        class_id: lesson.classId,
        track_id: lesson.trackId,
        specialization_id: lesson.specializationId,
      },
      audienceByLesson
    );
    return {
      id: o.id,
      date: o.occurrence_date,
      status: o.status,
      subject: lesson.subject,
      subjectId: lesson.subjectId ?? lesson.id,
      lessonNumber: o.lesson_number ?? lesson.lesson_number ?? 0,
      periodCount: o.lesson_number != null ? 1 : (lesson.period_count ?? 1),
      teacherName: lesson.teacherName,
      teacherId: lesson.teacherId,
      lessonId: lesson.id,
      classId: lesson.classId,
      trackId: lesson.trackId,
      specializationId: lesson.specializationId,
      attendanceRuleId: lesson.attendance_rule_id,
      groupLabel: lesson.groupLabel,
      calcUnitKey: calcUnitForLesson(lesson.id, poolCatalog.byLesson).key,
      audienceKey: audienceKey({
        teacherId: lesson.teacherId,
        subject: lesson.subjectRaw,
        gradeIds: audience.grade_ids,
        classIds: audience.class_ids,
        trackIds: audience.track_ids,
        specializationIds: audience.specialization_ids,
        forPsychology: lesson.for_psychology,
      }),
    };
  }

  let monthOccurrences = rawOccs
    .filter((o) => o.status !== "cancelled")
    .filter((o) => o.occurrence_date >= monthFrom && o.occurrence_date <= monthTo)
    .map((o) => {
      const lesson = lessonById.get(o.lesson_id);
      return lesson ? mapOccurrence(o, lesson) : null;
    })
    .filter((o): o is MappedOcc => o !== null);

  monthOccurrences = monthOccurrences.filter((o) =>
    lessonMatchesAudienceFilter(
      audienceForLesson(
        {
          id: o.lessonId,
          class_id: o.classId,
          track_id: o.trackId,
          specialization_id: o.specializationId,
        },
        audienceByLesson
      ),
      {
        classId: params.classId,
        trackId: params.trackId,
        specializationId: params.specializationId,
      }
    )
  );
  if (params.teacherId) monthOccurrences = monthOccurrences.filter((o) => o.teacherId === params.teacherId);
  if (params.subject) {
    monthOccurrences = monthOccurrences.filter(
      (o) => o.subject === params.subject || o.subject.startsWith(`${params.subject} ·`)
    );
  }
  if (params.lessonId) monthOccurrences = monthOccurrences.filter((o) => o.lessonId === params.lessonId);
  if (params.studentId) {
    const links = studentLinks.data ?? [];
    monthOccurrences = monthOccurrences.filter((o) =>
      links.some(
        (la) =>
          la.lesson_id === o.lessonId && isDateInRange(o.date, la.start_date, la.end_date)
      )
    );
  }

  const dayOccurrences = monthOccurrences.filter((o) => o.date === selectedDate);
  const allStudentsMap = new Map(shell.allStudents.map((s) => [s.id, s]));
  const allStudents = shell.allStudents;

  const selectedRaw =
    params.occurrenceId && dayOccurrences.find((o) => o.id === params.occurrenceId)
      ? dayOccurrences.find((o) => o.id === params.occurrenceId)!
      : dayOccurrences.length === 1
        ? dayOccurrences[0]
        : null;

  let lessonStudents: ShellStudent[] = [];

  const monthOccIds = monthOccurrences.map((o) => o.id);
  const monthLessonIds = [...new Set(monthOccurrences.map((o) => o.lessonId))];
  const attendanceOccIds = params.lessonId ? rawOccs.map((o) => o.id) : monthOccIds;
  const linkLessonIds = params.lessonId
    ? [params.lessonId]
    : monthLessonIds;

  const [monthLinks, monthAttendance] = await Promise.all([
    fetchAssignmentsByLessons<{
      lesson_id: string;
      student_id: string;
      start_date: string;
      end_date: string | null;
      students: unknown;
    }>(
      supabase,
      linkLessonIds,
      "lesson_id, student_id, start_date, end_date, students(id, full_name, first_name, last_name, is_active)"
    ),
    fetchAttendanceForOccurrences<{
      student_id: string;
      lesson_occurrence_id: string;
      status: string;
      reason?: string | null;
    }>(supabase, attendanceOccIds, "student_id, lesson_occurrence_id, status, reason"),
  ]);

  function rosterStudent(link: {
    student_id: string;
    students: unknown;
  }): ShellStudent | null {
    const embedded = embedOne<ShellStudent>(link.students);
    const s = embedded ?? allStudentsMap.get(link.student_id) ?? null;
    if (!s || s.is_active === false) return null;
    return { ...s, id: s.id || link.student_id };
  }

  function linkCoversDate(
    link: { start_date: string; end_date: string | null },
    date: string
  ): boolean {
    return isDateInRange(date, link.start_date, link.end_date);
  }

  const linksByLesson = new Map<string, typeof monthLinks>();
  for (const link of monthLinks) {
    const list = linksByLesson.get(link.lesson_id);
    if (list) list.push(link);
    else linksByLesson.set(link.lesson_id, [link]);
  }
  const markedCountByOccurrence = new Map<string, number>();
  const attendanceByPair = new Map<string, (typeof monthAttendance)[number]>();
  for (const row of monthAttendance) {
    markedCountByOccurrence.set(
      row.lesson_occurrence_id,
      (markedCountByOccurrence.get(row.lesson_occurrence_id) ?? 0) + 1
    );
    attendanceByPair.set(`${row.lesson_occurrence_id}::${row.student_id}`, row);
  }

  function linksFor(lessonId: string) {
    return linksByLesson.get(lessonId) ?? [];
  }

  function countRoster(lessonId: string, date: string) {
    let count = 0;
    for (const link of linksFor(lessonId)) {
      if (!rosterStudent(link)) continue;
      if (!linkCoversDate(link, date)) continue;
      count++;
    }
    return count;
  }

  const studentCounts = new Map<string, number>();
  const markedCounts = new Map<string, number>();
  for (const occ of dayOccurrences) {
    studentCounts.set(occ.id, countRoster(occ.lessonId, occ.date));
    markedCounts.set(occ.id, markedCountByOccurrence.get(occ.id) ?? 0);
  }

  const dayBlocks = mergeAttendanceBlocks(
    dayOccurrences.map((o) => ({
      ...o,
      studentCount: studentCounts.get(o.id) ?? 0,
      markedCount: markedCounts.get(o.id) ?? 0,
    }))
  );

  const wantedId = params.occurrenceId || selectedRaw?.id;
  const selectedOcc =
    (wantedId && dayBlocks.find((b) => b.linkedOccurrenceIds.includes(wantedId))) ||
    (dayBlocks.length === 1 ? dayBlocks[0] : null);

  if (selectedOcc) {
    const map = new Map<string, ShellStudent>();
    for (const lessonId of selectedOcc.linkedLessonIds) {
      for (const link of linksFor(lessonId)) {
        if (!linkCoversDate(link, selectedOcc.date)) continue;
        const s = rosterStudent(link);
        if (s) map.set(s.id, s);
      }
    }
    lessonStudents = [...map.values()].sort(compareStudentsByLastName);

    if (params.studentId) {
      lessonStudents = lessonStudents.filter((s) => s.id === params.studentId);
    }
  }

  const dayOccIds = dayOccurrences.map((o) => o.id);
  const selectedOccIds = new Set(selectedOcc?.linkedOccurrenceIds ?? []);
  const attendanceRecords = monthAttendance.filter((a) =>
    selectedOcc
      ? selectedOccIds.has(a.lesson_occurrence_id)
      : dayOccIds.includes(a.lesson_occurrence_id)
  );

  const completeDates: string[] = [];
  const partialDates: string[] = [];
  if (monthOccurrences.length > 0) {
    const monthStudentCounts = new Map<string, number>();
    const monthMarkedCounts = new Map<string, number>();
    for (const occ of monthOccurrences) {
      monthStudentCounts.set(occ.id, countRoster(occ.lessonId, occ.date));
      monthMarkedCounts.set(occ.id, markedCountByOccurrence.get(occ.id) ?? 0);
    }

    const occsByDate = new Map<string, typeof monthOccurrences>();
    for (const o of monthOccurrences) {
      const list = occsByDate.get(o.date) ?? [];
      list.push(o);
      occsByDate.set(o.date, list);
    }
    for (const [date, occs] of occsByDate) {
      if (params.studentId) {
        const allDone = occs.every((o) =>
          attendanceByPair.has(`${o.id}::${params.studentId}`)
        );
        if (allDone) completeDates.push(date);
        else partialDates.push(date);
        continue;
      }
      const withStudents = occs.filter((o) => (monthStudentCounts.get(o.id) ?? 0) > 0);
      if (withStudents.length === 0) continue;
      const allDone = withStudents.every((o) => {
        const total = monthStudentCounts.get(o.id) ?? 0;
        const marked = monthMarkedCounts.get(o.id) ?? 0;
        return marked >= total;
      });
      if (allDone) completeDates.push(date);
      else partialDates.push(date);
    }
  }

  const insightsByStudent: Record<string, StudentInsight> = {};
  if (selectedOcc && lessonStudents.length > 0) {
    const rule =
      catalog.rules.find((r) => r.id === selectedOcc.attendanceRuleId) ?? catalog.rules[0];
    const maxPct = rule ? Number(rule.max_allowed_absence_percent) : null;
    const selectedUnitKey = calcUnitForLesson(selectedOcc.lessonId, poolCatalog.byLesson).key;
    const lessonOccs = monthOccurrences
      .filter((o) => o.calcUnitKey === selectedUnitKey)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const student of lessonStudents) {
      const eligible = lessonOccs
        .filter((o) => {
          if (o.date > selectedOcc.date) return false;
          return linksFor(o.lessonId).some(
            (link) => link.student_id === student.id && linkCoversDate(link, o.date)
          );
        })
        .map((o) => {
          const att = attendanceByPair.get(`${o.id}::${student.id}`);
          return {
            occurrenceId: o.id,
            occurrenceDate: o.date,
            status: "scheduled" as const,
            attendanceStatus: att?.status as "present" | "absent" | "late" | undefined,
          };
        });
      const summary = summarizeAttendance(eligible);
      const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, maxPct);

      let streak = 0;
      for (let i = eligible.length - 1; i >= 0; i--) {
        const s = eligible[i].attendanceStatus;
        if (s === "present" || s === "late") streak++;
        else break;
      }

      insightsByStudent[student.id] = {
        absencePercent: summary.absencePercent,
        ruleLevel: evaluated.level,
        presentStreak: streak,
      };
    }
  }

  let noteBody = "";
  if (selectedOcc) {
    const { data: note } = await supabase
      .from("attendance_notes")
      .select("body")
      .eq("lesson_occurrence_id", selectedOcc.id)
      .maybeSingle();
    noteBody = note?.body ?? "";
  } else if (mode === "single" && params.studentId) {
    const { data: note } = await supabase
      .from("attendance_notes")
      .select("body")
      .eq("academic_year_id", activeYear.id)
      .eq("student_id", params.studentId)
      .maybeSingle();
    noteBody = note?.body ?? "";
  }

  let selectedLessonOccurrences: Array<{
    id: string;
    date: string;
    studentCount: number;
    markedCount: number;
    cancelled: boolean;
  }> = [];
  if (params.lessonId) {
    selectedLessonOccurrences = rawOccs
      .filter((o) => o.lesson_id === params.lessonId)
      .map((o) => ({
        id: o.id,
        date: o.occurrence_date,
        studentCount: countRoster(o.lesson_id, o.occurrence_date),
        markedCount: markedCountByOccurrence.get(o.id) ?? 0,
        cancelled: o.status === "cancelled",
      }));
  }

  const prevWeekIncompleteRaw = selectedOcc
    ? await findIncompletePreviousWeekOccurrences(supabase, selectedOcc.id)
    : [];
  const prevWeekIncomplete = blockingPreviousWeekGaps(prevWeekIncompleteRaw);
  const holidaySets = holidayDatesByKind(shell.holidayRows);

  const pastGaps =
    selectedOcc && prevWeekIncompleteRaw.length > 0
      ? prevWeekIncompleteRaw
          .filter((i) => i.gapHandling !== "continued")
          .map((i) => ({
            lessonId: selectedOcc.lessonId,
            subject: selectedOcc.subject,
            date: i.date,
            occurrenceId: i.id,
            gapHandling: i.gapHandling,
          }))
      : [];

  const dayOccurrenceIds = dayBlocks.flatMap((o) =>
    o.linkedOccurrenceIds?.length ? o.linkedOccurrenceIds : [o.id]
  );
  let occurrenceIdsWithNotes: string[] = [];
  if (dayOccurrenceIds.length > 0) {
    const { data: noteRows } = await supabase
      .from("attendance_notes")
      .select("lesson_occurrence_id")
      .in("lesson_occurrence_id", dayOccurrenceIds)
      .not("body", "eq", "");
    occurrenceIdsWithNotes = (noteRows ?? [])
      .map((n) => n.lesson_occurrence_id)
      .filter(Boolean) as string[];
  }

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader title="נוכחות" size="headline" />

      <AttendanceReminderBanner summary={pendingSummary} />

      <AttendanceBoard
        yearId={activeYear.id}
        monthFrom={monthFrom}
        monthTo={monthTo}
        selectedDate={selectedDate}
        selectedOccurrenceId={selectedOcc?.id ?? params.occurrenceId}
        mode={mode}
        classId={params.classId}
        trackId={params.trackId}
        specializationId={params.specializationId}
        teacherId={params.teacherId}
        subject={params.subject}
        studentId={params.studentId}
        lessonId={params.lessonId}
        classes={catalog.classes}
        tracks={catalog.tracks}
        specializations={catalog.specializations}
        teachers={catalog.teachers}
        subjects={shell.subjects}
        lessons={shell.lessons.map((l) => ({
          id: l.id,
          subject: l.subject,
          subjectKey: l.subjectKey,
          teacherId: l.teacherId,
          teacherName: l.teacherName,
          classId: l.classId,
          trackId: l.trackId,
          specializationId: l.specializationId,
          groupLabel: l.groupLabel,
          day_of_week: l.day_of_week ?? undefined,
          lesson_number: l.lesson_number ?? undefined,
          period_count: l.period_count ?? undefined,
        }))}
        selectedLessonOccurrences={selectedLessonOccurrences}
        prevWeekBlocked={
          prevWeekIncomplete.length > 0 && (selectedOcc?.markedCount ?? 0) === 0
        }
        prevWeekIncomplete={prevWeekIncomplete}
        allStudents={allStudents}
        monthOccurrences={monthOccurrences}
        dayOccurrences={dayBlocks.map((o) => ({
          id: o.id,
          date: o.date,
          status: o.status,
          subject: o.subject,
          teacherName: o.teacherName,
          lessonId: o.lessonId,
          lessonNumber: o.lessonNumber,
          periodCount: o.periodCount,
          groupLabel: o.groupLabel,
          studentCount: o.studentCount,
          markedCount: o.markedCount,
          linkedOccurrenceIds: o.linkedOccurrenceIds,
        }))}
        lessonStudents={lessonStudents}
        attendance={attendanceRecords}
        noteBody={noteBody}
        noteOccurrenceId={selectedOcc?.id ?? null}
        completeDates={completeDates}
        partialDates={partialDates}
        holidayDates={holidaySets.vacation}
        cancelledDates={holidaySets.cancelled}
        studyRanges={shell.activityRanges}
        insightsByStudent={insightsByStudent}
        pastGaps={pastGaps}
        occurrenceIdsWithNotes={occurrenceIdsWithNotes}
      />
    </div>
  );
}
