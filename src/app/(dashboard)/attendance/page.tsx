import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear, getYearCatalog } from "@/lib/utils";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  todayIso,
} from "@/lib/dates/hebrew";
import {
  evaluateAbsenceAgainstRule,
  summarizeAttendance,
} from "@/lib/attendance/calculator";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";
import { holidayDateSet } from "@/lib/lessons/holidays";
import {
  audienceForLesson,
  audienceMapFromRows,
  lessonMatchesAudienceFilter,
} from "@/lib/lessons/autoAssign";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
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

  const catalog = await getYearCatalog(activeYear.id);

  const [{ data: yearStudents }, { data: monthOccurrencesRaw }, { data: holidayRows }, { data: audienceRows }, { data: yearLessonRows }, { data: studentLinks }] =
    await Promise.all([
    supabase
      .from("student_assignments")
      .select("student_id, class_id, track_id, specialization_id, students(id, full_name, is_active)")
      .eq("academic_year_id", activeYear.id)
      .is("end_date", null),
    supabase
      .from("lesson_occurrences")
      .select(
        `id, occurrence_date, lesson_id,
         lessons!inner(
           id, subject, lesson_number, class_id, track_id, specialization_id, academic_year_id, attendance_rule_id,
           teacher_teaching_assignments(teacher_id, teachers(full_name))
         )`
      )
      .eq("lessons.academic_year_id", activeYear.id)
      .gte("occurrence_date", monthFrom)
      .lte("occurrence_date", monthTo)
      .neq("status", "cancelled")
      .order("occurrence_date"),
    supabase
      .from("holiday_periods")
      .select("start_date, end_date")
      .eq("academic_year_id", activeYear.id),
    supabase.from("lesson_audience").select("lesson_id, class_id, track_id, specialization_id"),
    supabase
      .from("lessons")
      .select("id, subject, day_of_week, lesson_number, period_count")
      .eq("academic_year_id", activeYear.id)
      .order("subject"),
    params.studentId
      ? supabase
          .from("student_lesson_assignments")
          .select("lesson_id, start_date, end_date")
          .eq("student_id", params.studentId)
      : Promise.resolve({ data: [] as { lesson_id: string; start_date: string; end_date: string | null }[] }),
  ]);

  type LessonJoin = {
    id: string;
    subject: string;
    lesson_number: number | null;
    class_id: string | null;
    track_id: string | null;
    specialization_id: string | null;
    attendance_rule_id: string | null;
    teacher_teaching_assignments: {
      teacher_id: string;
      teachers: { full_name: string } | null;
    } | null;
  };

  function mapOccurrence(o: NonNullable<typeof monthOccurrencesRaw>[number]) {
    const lesson = o.lessons as unknown as LessonJoin;
    const teacher = lesson.teacher_teaching_assignments?.teachers;
    return {
      id: o.id,
      date: o.occurrence_date,
      subject: lesson.subject,
      lessonNumber: lesson.lesson_number ?? 0,
      teacherName: teacher?.full_name ?? "",
      teacherId: lesson.teacher_teaching_assignments?.teacher_id ?? "",
      lessonId: lesson.id,
      classId: lesson.class_id,
      trackId: lesson.track_id,
      specializationId: lesson.specialization_id,
      attendanceRuleId: lesson.attendance_rule_id,
    };
  }

  const audienceByLesson = audienceMapFromRows(audienceRows ?? []);
  let monthOccurrences = (monthOccurrencesRaw ?? []).map(mapOccurrence);

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
  if (params.subject) monthOccurrences = monthOccurrences.filter((o) => o.subject === params.subject);
  if (params.lessonId) monthOccurrences = monthOccurrences.filter((o) => o.lessonId === params.lessonId);
  if (params.studentId) {
    const links = studentLinks ?? [];
    monthOccurrences = monthOccurrences.filter((o) =>
      links.some(
        (la) =>
          la.lesson_id === o.lessonId &&
          la.start_date <= o.date &&
          (la.end_date === null || la.end_date >= o.date)
      )
    );
  }

  const dayOccurrences = monthOccurrences.filter((o) => o.date === selectedDate);

  const allStudentsMap = new Map<string, { id: string; full_name: string }>();
  for (const row of yearStudents ?? []) {
    const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
    if (s?.is_active) allStudentsMap.set(s.id, { id: s.id, full_name: s.full_name });
  }
  const allStudents = [...allStudentsMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );

  const selectedOcc =
    params.occurrenceId && dayOccurrences.find((o) => o.id === params.occurrenceId)
      ? dayOccurrences.find((o) => o.id === params.occurrenceId)!
      : dayOccurrences.length === 1
        ? dayOccurrences[0]
        : null;

  let lessonStudents: { id: string; full_name: string }[] = [];

  const monthOccIds = monthOccurrences.map((o) => o.id);
  const monthLessonIds = [...new Set(monthOccurrences.map((o) => o.lessonId))];

  // Single bundled fetch for links + month attendance (perf)
  const [{ data: monthLinks }, { data: monthAttendance }] = await Promise.all([
    monthLessonIds.length > 0
      ? supabase
          .from("student_lesson_assignments")
          .select("lesson_id, student_id, start_date, end_date, students(id, full_name, is_active)")
          .in("lesson_id", monthLessonIds)
      : Promise.resolve({ data: [] as never[] }),
    monthOccIds.length > 0
      ? supabase
          .from("attendance")
          .select("student_id, lesson_occurrence_id, status, reason")
          .in("lesson_occurrence_id", monthOccIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  if (selectedOcc) {
    const map = new Map<string, { id: string; full_name: string }>();
    for (const link of monthLinks ?? []) {
      if (link.lesson_id !== selectedOcc.lessonId) continue;
      if (link.start_date > selectedOcc.date) continue;
      if (link.end_date && link.end_date < selectedOcc.date) continue;
      const s = link.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
      if (s?.is_active) map.set(s.id, { id: s.id, full_name: s.full_name });
    }
    lessonStudents = [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));

    if (params.studentId) {
      lessonStudents = lessonStudents.filter((s) => s.id === params.studentId);
    }
  }

  const dayOccIds = dayOccurrences.map((o) => o.id);
  const attendanceRecords = (monthAttendance ?? []).filter((a) =>
    selectedOcc ? a.lesson_occurrence_id === selectedOcc.id : dayOccIds.includes(a.lesson_occurrence_id)
  );

  const studentCounts = new Map<string, number>();
  const markedCounts = new Map<string, number>();
  for (const occ of dayOccurrences) {
    let count = 0;
    for (const link of monthLinks ?? []) {
      if (link.lesson_id !== occ.lessonId) continue;
      const active = (link.students as unknown as { is_active: boolean } | null)?.is_active;
      if (!active) continue;
      if (link.start_date > occ.date) continue;
      if (link.end_date && link.end_date < occ.date) continue;
      count++;
    }
    studentCounts.set(occ.id, count);
    markedCounts.set(
      occ.id,
      (monthAttendance ?? []).filter((a) => a.lesson_occurrence_id === occ.id).length
    );
  }

  // completeDates / partialDates for calendar colors
  const completeDates: string[] = [];
  const partialDates: string[] = [];
  if (monthOccurrences.length > 0) {
    const monthStudentCounts = new Map<string, number>();
    const monthMarkedCounts = new Map<string, number>();
    for (const occ of monthOccurrences) {
      let count = 0;
      for (const link of monthLinks ?? []) {
        if (link.lesson_id !== occ.lessonId) continue;
        const active = (link.students as unknown as { is_active: boolean } | null)?.is_active;
        if (!active) continue;
        if (link.start_date > occ.date) continue;
        if (link.end_date && link.end_date < occ.date) continue;
        count++;
      }
      monthStudentCounts.set(occ.id, count);
      monthMarkedCounts.set(
        occ.id,
        (monthAttendance ?? []).filter((a) => a.lesson_occurrence_id === occ.id).length
      );
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
          (monthAttendance ?? []).some(
            (a) => a.lesson_occurrence_id === o.id && a.student_id === params.studentId
          )
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

  // Insights for students in selected lesson
  const insightsByStudent: Record<string, StudentInsight> = {};
  if (selectedOcc && lessonStudents.length > 0) {
    const rule =
      catalog.rules.find((r) => r.id === selectedOcc.attendanceRuleId) ?? catalog.rules[0];
    const maxPct = rule ? Number(rule.max_allowed_absence_percent) : null;
    const lessonOccs = monthOccurrences
      .filter((o) => o.lessonId === selectedOcc.lessonId)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const student of lessonStudents) {
      const eligible = lessonOccs
        .filter((o) => o.date <= selectedOcc.date)
        .map((o) => {
          const att = (monthAttendance ?? []).find(
            (a) => a.lesson_occurrence_id === o.id && a.student_id === student.id
          );
          return {
            occurrenceId: o.id,
            occurrenceDate: o.date,
            status: "scheduled",
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
      .eq("academic_year_id", activeYear.id)
      .eq("lesson_id", selectedOcc.lessonId)
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

  const subjects = [...new Set((yearLessonRows ?? []).map((l) => l.subject))].sort((a, b) =>
    a.localeCompare(b, "he")
  );
  const lessonOptions = (yearLessonRows ?? []).map((l) => ({
    id: l.id,
    subject: l.subject,
    day_of_week: l.day_of_week,
    lesson_number: l.lesson_number,
    period_count: l.period_count,
  }));

  const pendingSummary = await getPendingAttendanceSummary(activeYear.id);

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
        subjects={subjects}
        lessons={lessonOptions}
        allStudents={allStudents}
        monthOccurrences={monthOccurrences}
        dayOccurrences={dayOccurrences.map((o) => ({
          ...o,
          studentCount: studentCounts.get(o.id) ?? 0,
          markedCount: markedCounts.get(o.id) ?? 0,
        }))}
        lessonStudents={lessonStudents}
        attendance={attendanceRecords}
        noteBody={noteBody}
        noteLessonId={selectedOcc?.lessonId ?? null}
        completeDates={completeDates}
        partialDates={partialDates}
        holidayDates={[...holidayDateSet(holidayRows ?? [])]}
        insightsByStudent={insightsByStudent}
      />
    </div>
  );
}
