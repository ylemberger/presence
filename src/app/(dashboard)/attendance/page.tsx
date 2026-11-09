import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  isDateInRange,
  schoolYearIsoBounds,
  todayIso,
} from "@/lib/dates/hebrew";
import {
  generateLessonOccurrences,
  lessonScheduleWindow,
  scrubScheduledOccurrencesOnDate,
  syncLessonOccurrences,
} from "@/lib/lessons/occurrences";
import { mergeAttendanceBlocks } from "@/lib/attendance/blocks";
import { holidayDatesByKind } from "@/lib/lessons/holidays";
import { audienceForLesson, lessonMatchesAudienceFilter } from "@/lib/lessons/autoAssign";
import { audienceKey } from "@/lib/lessons/group-label";
import { calcUnitForLesson, lessonIdsInCalcUnit } from "@/lib/attendance/pools";
import {
  blockingPreviousWeekGaps,
  findIncompletePreviousWeekOccurrences,
} from "@/lib/attendance/previous-week";
import { loadAttendanceShell, type ShellLesson, type ShellStudent } from "@/lib/attendance/load-shell";
import { bustAttendanceShellCache } from "@/lib/attendance/shell-cache";
import {
  fetchAttendanceCountsByOccurrence,
  fetchAttendanceForOccurrences,
  fetchSkinnyOccurrences,
} from "@/lib/attendance/load-occurrences";
import { embedOne } from "@/lib/supabase/embed";
import { chunkIds, fetchAllPages, fetchAssignmentsByLessons } from "@/lib/supabase/paged";
import { compareStudentsByLastName } from "@/lib/students/sort";
import { AttendanceBoard, type AttendanceMode } from "./AttendanceBoard";

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
  const schoolBounds = schoolYearIsoBounds(selectedDate);

  // Lesson search: clip to activity range; soft-sync only when schedule and DB diverge.
  let lessonWindow: Awaited<ReturnType<typeof lessonScheduleWindow>> = null;
  if (params.lessonId) {
    try {
      lessonWindow = await lessonScheduleWindow(params.lessonId, schoolBounds, supabase);
      const fromDate = lessonWindow?.fromDate ?? schoolBounds.start;
      const toDate = lessonWindow?.toDate ?? schoolBounds.end;
      const { count, error: countError } = await supabase
        .from("lesson_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", params.lessonId)
        .gte("occurrence_date", fromDate)
        .lte("occurrence_date", toDate);
      if (!countError && (count ?? 0) === 0) {
        await generateLessonOccurrences(params.lessonId, undefined, supabase);
      }
    } catch {
      // Keep listing meetings that already exist.
    }
  }

  const lessonSheetFrom = params.lessonId
    ? (lessonWindow?.fromDate ?? schoolBounds.start)
    : schoolBounds.start;
  const lessonSheetTo = params.lessonId
    ? (lessonWindow?.toDate ?? schoolBounds.end)
    : schoolBounds.end;

  // Pending banner lives in the layout Suspense — keep it off this page's critical path.
  const [shell, studentLinks] = await Promise.all([
    loadAttendanceShell(activeYear.id),
    params.studentId
      ? fetchAllPages<{ lesson_id: string; start_date: string; end_date: string | null }>((from, to) =>
          supabase
            .from("student_lesson_assignments")
            .select("lesson_id, start_date, end_date")
            .eq("student_id", params.studentId)
            .range(from, to)
        ).then((rows) => ({ data: rows }))
      : Promise.resolve({ data: [] as { lesson_id: string; start_date: string; end_date: string | null }[] }),
  ]);

  const yearLessonIds = shell.lessons.map((l) => l.id);
  const studentLinkedLessonIds = new Set(
    (studentLinks.data ?? []).map((row) => row.lesson_id)
  );
  const subjectMatchesLesson = (lesson: ShellLesson) => {
    if (!params.subject) return false;
    return (
      lesson.subjectKey === params.subject ||
      lesson.subject === params.subject ||
      lesson.subject.startsWith(`${params.subject} ·`) ||
      lesson.subjectRaw === params.subject
    );
  };
  /** Student + lesson, or student + subject: year-long meeting sheet. */
  const subjectSheetLessonIds =
    params.studentId && params.subject && !params.lessonId
      ? shell.lessons
          .filter((l) => studentLinkedLessonIds.has(l.id) && subjectMatchesLesson(l))
          .map((l) => l.id)
      : [];
  const yearSheetMode = Boolean(
    params.lessonId || (params.studentId && params.subject && subjectSheetLessonIds.length > 0)
  );
  const yearSheetLessonIds = params.lessonId
    ? [params.lessonId]
    : subjectSheetLessonIds;

  let rawOccs = await fetchSkinnyOccurrences(supabase, {
    yearLessonIds: yearSheetMode && !params.lessonId ? yearSheetLessonIds : yearLessonIds,
    lessonId: params.lessonId,
    fromDate: yearSheetMode
      ? params.lessonId
        ? lessonSheetFrom
        : schoolBounds.start
      : monthFrom,
    toDate: yearSheetMode ? (params.lessonId ? lessonSheetTo : schoolBounds.end) : monthTo,
    includeCancelled: yearSheetMode,
    chunkByLesson: Boolean(params.studentId && params.subject && !params.lessonId),
  });

  // Soft-sync drops unmarked off-schedule meetings. Display always matches the lesson schedule
  // (same dates as the calendar), even if marked leftovers remain in the DB.
  if (params.lessonId && lessonWindow && lessonWindow.expectedKeys.size > 0) {
    const keyOf = (o: (typeof rawOccs)[number]) =>
      o.lesson_number == null ? null : `${o.occurrence_date}|${o.lesson_number}`;
    const hasStale = rawOccs.some((o) => {
      const key = keyOf(o);
      return key != null && !lessonWindow!.expectedKeys.has(key);
    });
    if (hasStale) {
      try {
        await syncLessonOccurrences(params.lessonId, supabase, { keepMarked: true });
        rawOccs = await fetchSkinnyOccurrences(supabase, {
          yearLessonIds,
          lessonId: params.lessonId,
          fromDate: lessonSheetFrom,
          toDate: lessonSheetTo,
          includeCancelled: true,
        });
      } catch {
        // Keep listing; filter below still clips to the schedule.
      }
    }
    rawOccs = rawOccs.filter((o) => {
      if (o.status === "cancelled") return true;
      const key = keyOf(o);
      if (key == null) return true;
      return lessonWindow!.expectedKeys.has(key);
    });
  }

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

  const holidaySetsEarly = holidayDatesByKind(shell.holidayRows);
  const cancelledDateSet = new Set(holidaySetsEarly.cancelled);
  const vacationDateSet = new Set(holidaySetsEarly.vacation);
  // Repair leftover scheduled rows on a cancelled/vacation day (saved before paging fix).
  if (cancelledDateSet.has(selectedDate) || vacationDateSet.has(selectedDate)) {
    try {
      await scrubScheduledOccurrencesOnDate(activeYear.id, selectedDate, supabase);
    } catch {
      // UI still hides the day; DB cleanup can wait for the next holiday save.
    }
  }
  // Keep cancelled/vacation days off the month calendar and day roster.
  monthOccurrences = monthOccurrences.filter(
    (o) => !cancelledDateSet.has(o.date) && !vacationDateSet.has(o.date)
  );
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

  const dayLessonIds = [...new Set(dayOccurrences.map((o) => o.lessonId))];
  const dayOccIds = dayOccurrences.map((o) => o.id);
  const clickedOcc =
    (params.occurrenceId && dayOccurrences.find((o) => o.id === params.occurrenceId)) ||
    selectedRaw ||
    null;

  let linkLessonIds: string[];
  let attendanceOccIds: string[];
  let calendarFromStatus = false;
  /** Lesson search: count marks for the year list; full rows only for the open meeting. */
  const lessonSearchCounts = Boolean(params.lessonId) && !params.studentId;
  const yearOccIdsForCounts = lessonSearchCounts ? rawOccs.map((o) => o.id) : [];
  const studentYearSheet = Boolean(params.studentId && yearSheetMode);

  if (params.lessonId || studentYearSheet) {
    linkLessonIds = params.lessonId ? [params.lessonId] : yearSheetLessonIds;
    if (params.studentId) {
      // One student's marks across the year sheet — needed for the picker per meeting.
      attendanceOccIds = rawOccs.map((o) => o.id);
    } else {
      const openIds = new Set(dayOccIds);
      if (params.occurrenceId) openIds.add(params.occurrenceId);
      attendanceOccIds = [...openIds];
    }
  } else if (params.studentId) {
    linkLessonIds = [...new Set(monthOccurrences.map((o) => o.lessonId))];
    attendanceOccIds = monthOccurrences.map((o) => o.id);
  } else if (clickedOcc) {
    linkLessonIds = lessonIdsInCalcUnit(clickedOcc.lessonId, poolCatalog);
    const focus = new Set(linkLessonIds);
    attendanceOccIds = monthOccurrences.filter((o) => focus.has(o.lessonId)).map((o) => o.id);
  } else {
    linkLessonIds = dayLessonIds;
    attendanceOccIds = dayOccIds;
    calendarFromStatus = true;
  }

  const [monthLinks, monthAttendance, lessonMarkCounts, exclusionRows] = await Promise.all([
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
    }>(
      supabase,
      attendanceOccIds,
      "student_id, lesson_occurrence_id, status, reason",
      params.studentId
    ),
    lessonSearchCounts
      ? fetchAttendanceCountsByOccurrence(supabase, yearOccIdsForCounts)
      : Promise.resolve(new Map<string, number>()),
    linkLessonIds.length > 0
      ? Promise.all(
          chunkIds(linkLessonIds).map((chunk) =>
            fetchAllPages<{ student_id: string; lesson_id: string }>((from, to) =>
              supabase
                .from("student_lesson_exclusions")
                .select("student_id, lesson_id")
                .in("lesson_id", chunk)
                .range(from, to)
            )
          )
        )
          .then((pages) => pages.flat())
          .catch(() => [] as { student_id: string; lesson_id: string }[])
      : Promise.resolve([] as { student_id: string; lesson_id: string }[]),
  ]);

  const excludedPairs = new Set(
    exclusionRows.map((row) => `${row.lesson_id}::${row.student_id}`)
  );

  function rosterStudent(link: {
    student_id: string;
    lesson_id?: string;
    students: unknown;
  }): ShellStudent | null {
    if (link.lesson_id && excludedPairs.has(`${link.lesson_id}::${link.student_id}`)) {
      return null;
    }
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
    if (excludedPairs.has(`${link.lesson_id}::${link.student_id}`)) continue;
    const list = linksByLesson.get(link.lesson_id);
    if (list) list.push(link);
    else linksByLesson.set(link.lesson_id, [link]);
  }
  const markedCountByOccurrence = new Map<string, number>(lessonMarkCounts);
  const attendanceByPair = new Map<string, (typeof monthAttendance)[number]>();
  for (const row of monthAttendance) {
    if (!lessonSearchCounts) {
      markedCountByOccurrence.set(
        row.lesson_occurrence_id,
        (markedCountByOccurrence.get(row.lesson_occurrence_id) ?? 0) + 1
      );
    }
    attendanceByPair.set(`${row.lesson_occurrence_id}::${row.student_id}`, row);
  }

  function linksFor(lessonId: string) {
    return linksByLesson.get(lessonId) ?? [];
  }

  const rosterCountByLessonDate = new Map<string, number>();
  function countRoster(lessonId: string, date: string) {
    const key = `${lessonId}|${date}`;
    const cached = rosterCountByLessonDate.get(key);
    if (cached != null) return cached;
    const ids = new Set<string>();
    for (const link of linksFor(lessonId)) {
      const student = rosterStudent(link);
      if (!student) continue;
      if (!linkCoversDate(link, date)) continue;
      ids.add(student.id);
    }
    rosterCountByLessonDate.set(key, ids.size);
    return ids.size;
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
  const openOccurrenceId =
    wantedId && selectedOcc?.linkedOccurrenceIds.includes(wantedId)
      ? wantedId
      : selectedOcc?.id ?? params.occurrenceId;

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

  if (params.studentId && lessonStudents.length === 0) {
    const one = allStudentsMap.get(params.studentId);
    if (one && one.is_active !== false) {
      lessonStudents = [one];
    }
  }

  const selectedOccIds = new Set(selectedOcc?.linkedOccurrenceIds ?? []);
  const attendanceRecords =
    studentYearSheet
      ? monthAttendance
      : monthAttendance.filter((a) =>
          selectedOcc
            ? selectedOccIds.has(a.lesson_occurrence_id)
            : dayOccIds.includes(a.lesson_occurrence_id)
        );

  const completeDates: string[] = [];
  const partialDates: string[] = [];
  if (monthOccurrences.length > 0) {
    const occsByDate = new Map<string, typeof monthOccurrences>();
    for (const o of monthOccurrences) {
      const list = occsByDate.get(o.date) ?? [];
      list.push(o);
      occsByDate.set(o.date, list);
    }

    if (calendarFromStatus) {
      for (const [date, occs] of occsByDate) {
        const active = occs.filter((o) => o.status !== "cancelled");
        if (active.length === 0) continue;
        if (active.every((o) => o.status === "completed")) completeDates.push(date);
        else if (active.some((o) => o.status === "completed")) partialDates.push(date);
      }
    } else {
      const monthStudentCounts = new Map<string, number>();
      const monthMarkedCounts = new Map<string, number>();
      for (const occ of monthOccurrences) {
        monthStudentCounts.set(occ.id, countRoster(occ.lessonId, occ.date));
        monthMarkedCounts.set(occ.id, markedCountByOccurrence.get(occ.id) ?? 0);
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
  }

  let selectedLessonOccurrences: Array<{
    id: string;
    date: string;
    lessonNumber: number | null;
    studentCount: number;
    markedCount: number;
    cancelled: boolean;
  }> = [];
  if (params.lessonId || studentYearSheet) {
    const studentCoverLinks = studentLinks.data ?? [];
    const sheetLessonSet = new Set(yearSheetLessonIds);
    selectedLessonOccurrences = rawOccs
      .filter((o) => sheetLessonSet.has(o.lesson_id))
      .filter((o) => {
        if (!params.studentId) return true;
        return studentCoverLinks.some(
          (la) =>
            la.lesson_id === o.lesson_id &&
            isDateInRange(o.occurrence_date, la.start_date, la.end_date)
        );
      })
      .map((o) => ({
        id: o.id,
        date: o.occurrence_date,
        lessonNumber: o.lesson_number,
        studentCount: countRoster(o.lesson_id, o.occurrence_date),
        markedCount: markedCountByOccurrence.get(o.id) ?? 0,
        cancelled:
          o.status === "cancelled" ||
          cancelledDateSet.has(o.occurrence_date) ||
          vacationDateSet.has(o.occurrence_date),
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0)
      );
  }

  const dayOccurrenceIds = dayBlocks.flatMap((o) =>
    o.linkedOccurrenceIds?.length ? o.linkedOccurrenceIds : [o.id]
  );

  const noteQuery = selectedOcc
    ? supabase
        .from("attendance_notes")
        .select("body")
        .eq("lesson_occurrence_id", selectedOcc.id)
        .maybeSingle()
    : mode === "single" && params.studentId
      ? supabase
          .from("attendance_notes")
          .select("body")
          .eq("academic_year_id", activeYear.id)
          .eq("student_id", params.studentId)
          .maybeSingle()
      : Promise.resolve({ data: null as { body: string | null } | null });

  const dayNotesQuery =
    dayOccurrenceIds.length > 0
      ? supabase
          .from("attendance_notes")
          .select("lesson_occurrence_id")
          .in("lesson_occurrence_id", dayOccurrenceIds)
          .not("body", "eq", "")
      : Promise.resolve({ data: [] as { lesson_occurrence_id: string }[] });

  // Previous-week check only blocks when the open meeting has no marks yet.
  const needsPrevWeekCheck =
    Boolean(openOccurrenceId) && (selectedOcc?.markedCount ?? 0) === 0;

  const [noteRes, prevWeekIncompleteRaw, dayNotesRes] = await Promise.all([
    noteQuery,
    needsPrevWeekCheck && openOccurrenceId
      ? findIncompletePreviousWeekOccurrences(supabase, openOccurrenceId)
      : Promise.resolve([]),
    dayNotesQuery,
  ]);

  const noteBody = noteRes.data?.body ?? "";
  const prevWeekIncomplete = blockingPreviousWeekGaps(prevWeekIncompleteRaw);
  const holidaySets = holidaySetsEarly;

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

  const occurrenceIdsWithNotes = (dayNotesRes.data ?? [])
    .map((n) => n.lesson_occurrence_id)
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-stack_lg print:gap-0">
      <PageHeader title="נוכחות" size="headline" />

      <AttendanceBoard
        yearId={activeYear.id}
        monthFrom={monthFrom}
        monthTo={monthTo}
        selectedDate={selectedDate}
        selectedOccurrenceId={openOccurrenceId}
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
        monthOccurrences={monthOccurrences.map((o) => ({ id: o.id, date: o.date }))}
        studentLessonIds={[...new Set((studentLinks.data ?? []).map((row) => row.lesson_id))]}
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
          linkedLessonIds: o.linkedLessonIds,
        }))}
        lessonStudents={lessonStudents}
        attendance={attendanceRecords}
        noteBody={noteBody}
        noteOccurrenceId={openOccurrenceId ?? null}
        completeDates={completeDates}
        partialDates={partialDates}
        holidayDates={holidaySets.vacation}
        cancelledDates={holidaySets.cancelled}
        studyRanges={shell.activityRanges}
        insightsByStudent={{}}
        pastGaps={pastGaps}
        occurrenceIdsWithNotes={occurrenceIdsWithNotes}
      />
    </div>
  );
}
