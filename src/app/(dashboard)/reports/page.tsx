import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader, StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { isDateInRange, formatHebrewDate, formatGregorianDate } from "@/lib/dates/hebrew";
import {
  summarizeAttendance,
  evaluateAbsenceAgainstRule,
  type EligibleOccurrence,
} from "@/lib/attendance/calculator";
import { ReportsFilter } from "./ReportsFilter";
import { PrintButton } from "@/components/ui/PrintButton";
import { ExportCsvButton } from "./ExportCsvButton";
import { ReportPrintFooter, ReportPrintHeader } from "./ReportPrintChrome";
import { StudentTrendChart } from "./StudentTrendChart";
import { todayIso } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ATTENDANCE_STATUS_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";

interface Props {
  searchParams: {
    classId?: string;
    gradeId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    lessonId?: string;
    occurrenceId?: string;
    minAbsence?: string;
    ruleId?: string;
    run?: string;
  };
}

function one<T>(v: unknown): T | null {
  if (!v) return null;
  return (Array.isArray(v) ? v[0] : v) as T;
}

function teacherFullName(ta: unknown): string {
  const assignment = one<{ teachers?: unknown }>(ta);
  const teacher = one<{ full_name?: string }>(assignment?.teachers);
  return teacher?.full_name ?? "";
}

function dayLabel(dayOfWeek: number): string {
  const name = DAY_OF_WEEK_LABELS[dayOfWeek];
  return name ? `יום ${name}` : "";
}

function lessonOptionLabel(
  subject: string,
  teacherName: string,
  dayOfWeek: number,
  lessonNumber: number
): string {
  return [subject, teacherName, dayLabel(dayOfWeek), lessonNumber ? `שיעור ${lessonNumber}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function statusLabel(status: AttendanceStatus | undefined): string {
  return status ? ATTENDANCE_STATUS_LABELS[status] : "לא סומן";
}

function buildReportHref(
  current: Props["searchParams"],
  next: { lessonId?: string | null; occurrenceId?: string | null } = {}
): string {
  const p = new URLSearchParams();
  for (const key of [
    "gradeId",
    "classId",
    "trackId",
    "specializationId",
    "teacherId",
    "subject",
    "studentId",
    "minAbsence",
    "ruleId",
  ] as const) {
    const value = current[key];
    if (value) p.set(key, value);
  }
  let lessonId = current.lessonId;
  let occurrenceId = current.occurrenceId;
  if (next.lessonId !== undefined) {
    lessonId = next.lessonId ?? undefined;
    occurrenceId = undefined;
  }
  if (next.occurrenceId !== undefined) {
    occurrenceId = next.occurrenceId ?? undefined;
  }
  if (lessonId) p.set("lessonId", lessonId);
  if (occurrenceId) p.set("occurrenceId", occurrenceId);
  p.set("run", "1");
  return `/reports?${p.toString()}`;
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader title="דוחות" description="יש להגדיר שנה אקדמית פעילה." />
      </div>
    );
  }

  const [{ data: yearRanges }] = await Promise.all([
    supabase.from("activity_ranges").select("start_date, end_date").eq("academic_year_id", activeYear.id),
  ]);
  const rangeStarts = (yearRanges ?? []).map((r) => r.start_date).sort();
  const rangeEnds = (yearRanges ?? []).map((r) => r.end_date).sort();
  const yearStart = rangeStarts[0] ?? activeYear.created_at.split("T")[0];
  const yearEnd = rangeEnds[rangeEnds.length - 1] ?? todayIso();
  const startDate = yearStart;
  const endDate = yearEnd < todayIso() ? yearEnd : todayIso();
  const minAbsence = params.minAbsence ? parseFloat(params.minAbsence) : 0;
  const shouldRun = true;

  const [
    { data: grades },
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: yearLessons },
    { data: allStudents },
    { data: rules },
  ] = await Promise.all([
    supabase.from("grades").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", activeYear.id).order("name"),
    supabase.from("tracks").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
    supabase
      .from("specializations")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    supabase
      .from("lessons")
      .select(
        `id, subject, class_id, track_id, specialization_id, teacher_teaching_assignment_id, day_of_week, lesson_number,
         teacher_teaching_assignments(teacher_id, teachers(full_name))`
      )
      .eq("academic_year_id", activeYear.id),
    supabase.from("students").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("attendance_rules").select("id, name, max_allowed_absence_percent").order("name"),
  ]);

  const subjects = [...new Set((yearLessons ?? []).map((l) => l.subject))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const selectedRule = (rules ?? []).find((r) => r.id === params.ruleId);
  const threshold = selectedRule
    ? Number(selectedRule.max_allowed_absence_percent)
    : minAbsence;
  /** Include warning band (80% of rule) when a rule is selected. */
  const includeFrom = selectedRule && threshold > 0 ? threshold * 0.8 : threshold;

  let reportRows: Array<{
    studentId: string;
    studentName: string;
    gradeName: string;
    className: string;
    totalRequired: number;
    presentOnlyCount: number;
    lateCount: number;
    absentCount: number;
    unmarkedCount: number;
    absencePercent: number;
    ruleLabel: string;
    ruleLevel: "ok" | "warning" | "blocked";
  }> = [];

  let lessonRows: Array<{
    lessonId: string;
    subject: string;
    teacherName: string;
    dayLabel: string;
    totalRequired: number;
    presentOnlyCount: number;
    lateCount: number;
    absentCount: number;
    unmarkedCount: number;
    absencePercent: number;
    ruleLabel: string;
    ruleLevel: "ok" | "warning" | "blocked";
  }> = [];

  let occurrenceRows: Array<{
    occurrenceId: string;
    date: string;
    totalRequired: number;
    presentOnlyCount: number;
    lateCount: number;
    absentCount: number;
    unmarkedCount: number;
    studentStatus?: string;
  }> = [];

  let occurrenceStudentRows: Array<{
    studentId: string;
    studentName: string;
    gradeName: string;
    className: string;
    status: string;
  }> = [];

  let trendMonths: Array<{
    label: string;
    present: number;
    late: number;
    absent: number;
  }> = [];

  let singleStudentName: string | null = null;

  type YearLesson = NonNullable<typeof yearLessons>[number];
  const lessonCatalog = new Map(
    (yearLessons ?? []).map((l) => [
      l.id,
      {
        id: l.id,
        subject: l.subject,
        teacherName: teacherFullName(l.teacher_teaching_assignments),
        dayOfWeek: l.day_of_week,
        lessonNumber: l.lesson_number,
      },
    ])
  );

  if (shouldRun) {
    let scopedLessonIds: string[] | null = null;
    let lessons: YearLesson[] = yearLessons ?? [];

    if (params.teacherId) {
      lessons = lessons.filter((l) => {
        const ta = one<{ teacher_id: string }>(l.teacher_teaching_assignments);
        return ta?.teacher_id === params.teacherId;
      });
    }
    if (params.subject) {
      lessons = lessons.filter((l) => l.subject === params.subject);
    }
    if (params.lessonId) {
      lessons = lessons.filter((l) => l.id === params.lessonId);
    }
    if (params.teacherId || params.subject || params.lessonId) {
      scopedLessonIds = lessons.map((l) => l.id);
    }

    let studentIds: string[] = [];
    if (params.studentId) {
      studentIds = [params.studentId];
    } else {
      let q = supabase
        .from("student_assignments")
        .select("student_id")
        .eq("academic_year_id", activeYear.id)
        .is("end_date", null);
      if (params.gradeId) q = q.eq("grade_id", params.gradeId);
      if (params.classId) q = q.eq("class_id", params.classId);
      if (params.trackId) q = q.eq("track_id", params.trackId);
      if (params.specializationId) q = q.eq("specialization_id", params.specializationId);
      const { data: assignments } = await q;
      studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];

      if (params.teacherId || params.subject || params.lessonId) {
        const { data: links } = await supabase
          .from("student_lesson_assignments")
          .select("student_id, lesson_id")
          .in(
            "lesson_id",
            scopedLessonIds?.length ? scopedLessonIds : ["00000000-0000-0000-0000-000000000000"]
          )
          .is("end_date", null);
        const fromLessons = new Set((links ?? []).map((l) => l.student_id));
        studentIds = studentIds.filter((id) => fromLessons.has(id));
      }
    }

    const lessonItems = new Map<string, EligibleOccurrence[]>();
    const occById = new Map<string, { date: string; items: EligibleOccurrence[] }>();

    if (studentIds.length > 0) {
      const [
        { data: students },
        { data: assignments },
        { data: lessonAssignments },
        { data: occurrences },
        { data: attendanceRecords },
      ] = await Promise.all([
        supabase.from("students").select("id, full_name").in("id", studentIds),
        supabase
          .from("student_assignments")
          .select("*, classes(name), grades(name)")
          .eq("academic_year_id", activeYear.id)
          .in("student_id", studentIds),
        supabase
          .from("student_lesson_assignments")
          .select("*, lessons!inner(academic_year_id)")
          .eq("lessons.academic_year_id", activeYear.id)
          .in("student_id", studentIds),
        supabase
          .from("lesson_occurrences")
          .select(
            `id, occurrence_date, status, lesson_id,
             lessons!inner(academic_year_id, subject, teacher_teaching_assignments(teachers(full_name)))`
          )
          .eq("lessons.academic_year_id", activeYear.id)
          .gte("occurrence_date", startDate)
          .lte("occurrence_date", endDate)
          .neq("status", "cancelled"),
        supabase.from("attendance").select("*").in("student_id", studentIds),
      ]);

      let occList = occurrences ?? [];
      if (scopedLessonIds) {
        const set = new Set(scopedLessonIds);
        occList = occList.filter((o) => set.has(o.lesson_id));
      }

      const studentMap = new Map((students ?? []).map((s) => [s.id, s.full_name]));
      const assignmentsByStudent = new Map<string, typeof assignments>();
      for (const a of assignments ?? []) {
        const list = assignmentsByStudent.get(a.student_id) ?? [];
        list.push(a);
        assignmentsByStudent.set(a.student_id, list);
      }
      const lessonByStudent = new Map<string, typeof lessonAssignments>();
      for (const la of lessonAssignments ?? []) {
        const list = lessonByStudent.get(la.student_id) ?? [];
        list.push(la);
        lessonByStudent.set(la.student_id, list);
      }
      const attendanceByStudent = new Map<string, typeof attendanceRecords>();
      for (const att of attendanceRecords ?? []) {
        const list = attendanceByStudent.get(att.student_id) ?? [];
        list.push(att);
        attendanceByStudent.set(att.student_id, list);
      }

      for (const studentId of studentIds) {
        const studentName = studentMap.get(studentId);
        if (!studentName) continue;

        const studentAssignments = assignmentsByStudent.get(studentId) ?? [];
        const studentLessonAssignments = lessonByStudent.get(studentId) ?? [];
        const studentAttendance = attendanceByStudent.get(studentId) ?? [];

        const eligible = occList.filter((o) => {
          const date = o.occurrence_date;
          const inAssignment = studentAssignments.some((a) =>
            isDateInRange(date, a.start_date, a.end_date)
          );
          const inLesson =
            studentLessonAssignments.length === 0 ||
            studentLessonAssignments.some(
              (la) =>
                la.lesson_id === o.lesson_id &&
                isDateInRange(date, la.start_date, la.end_date)
            );
          return inAssignment && inLesson;
        });

        const eligibleWithAttendance = eligible.map((o) => ({
          occurrenceId: o.id,
          occurrenceDate: o.occurrence_date,
          lessonId: o.lesson_id,
          status: o.status,
          attendanceStatus: studentAttendance.find((a) => a.lesson_occurrence_id === o.id)
            ?.status as AttendanceStatus | undefined,
        }));

        const summary = summarizeAttendance(eligibleWithAttendance);
        const currentAssignment =
          studentAssignments.find((a) => !a.end_date) ?? studentAssignments[0];
        const className =
          (currentAssignment?.classes as unknown as { name: string } | null)?.name ?? "-";
        const gradeName =
          (currentAssignment?.grades as unknown as { name: string } | null)?.name ?? "-";
        const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, threshold);

        reportRows.push({
          studentId,
          studentName,
          gradeName,
          className,
          totalRequired: summary.totalRequired,
          presentOnlyCount: summary.presentOnlyCount,
          lateCount: summary.lateCount,
          absentCount: summary.absentCount,
          unmarkedCount: summary.unmarked,
          absencePercent: summary.absencePercent,
          ruleLabel: evaluated.label,
          ruleLevel: evaluated.level,
        });

        for (const e of eligibleWithAttendance) {
          const lessonList = lessonItems.get(e.lessonId) ?? ([] as EligibleOccurrence[]);
          lessonList.push(e);
          lessonItems.set(e.lessonId, lessonList);

          if (params.lessonId && e.lessonId === params.lessonId) {
            const occ = occById.get(e.occurrenceId) ?? {
              date: e.occurrenceDate,
              items: [] as EligibleOccurrence[],
            };
            occ.items.push(e);
            occById.set(e.occurrenceId, occ);
          }

          if (params.occurrenceId && e.occurrenceId === params.occurrenceId) {
            occurrenceStudentRows.push({
              studentId,
              studentName,
              gradeName,
              className,
              status: statusLabel(e.attendanceStatus),
            });
          }
        }

        if (params.studentId && studentId === params.studentId) {
          singleStudentName = studentName;
          for (const la of studentLessonAssignments) {
            if (scopedLessonIds && !scopedLessonIds.includes(la.lesson_id)) continue;
            if (!lessonItems.has(la.lesson_id)) lessonItems.set(la.lesson_id, []);
          }
          const byMonth = new Map<string, { present: number; late: number; absent: number }>();
          for (const e of eligibleWithAttendance) {
            if (!e.attendanceStatus) continue;
            const key = e.occurrenceDate.slice(0, 7);
            const bucket = byMonth.get(key) ?? { present: 0, late: 0, absent: 0 };
            if (e.attendanceStatus === "present") bucket.present++;
            else if (e.attendanceStatus === "late") bucket.late++;
            else if (e.attendanceStatus === "absent") bucket.absent++;
            byMonth.set(key, bucket);
          }
          trendMonths = [...byMonth.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, v]) => ({
              label: key.slice(5),
              present: v.present,
              late: v.late,
              absent: v.absent,
            }));
        }
      }

      reportRows.sort((a, b) => b.absencePercent - a.absencePercent);
      occurrenceStudentRows.sort((a, b) => a.studentName.localeCompare(b.studentName, "he"));
    }

    const lessonIdsToShow = new Set(lessonItems.keys());
    if (params.teacherId || params.subject || params.lessonId) {
      for (const l of lessons) lessonIdsToShow.add(l.id);
    }

    for (const lessonId of lessonIdsToShow) {
      const meta = lessonCatalog.get(lessonId);
      if (!meta) continue;
      const summary = summarizeAttendance(lessonItems.get(lessonId) ?? []);
      const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, threshold);
      lessonRows.push({
        lessonId,
        subject: meta.subject,
        teacherName: meta.teacherName,
        dayLabel: dayLabel(meta.dayOfWeek),
        totalRequired: summary.totalRequired,
        presentOnlyCount: summary.presentOnlyCount,
        lateCount: summary.lateCount,
        absentCount: summary.absentCount,
        unmarkedCount: summary.unmarked,
        absencePercent: summary.absencePercent,
        ruleLabel: evaluated.label,
        ruleLevel: evaluated.level,
      });
    }
    lessonRows.sort((a, b) => a.subject.localeCompare(b.subject, "he"));

    if (params.lessonId) {
      occurrenceRows = [...occById.entries()]
        .map(([occurrenceId, { date, items }]) => {
          const summary = summarizeAttendance(items);
          return {
            occurrenceId,
            date,
            totalRequired: summary.totalRequired,
            presentOnlyCount: summary.presentOnlyCount,
            lateCount: summary.lateCount,
            absentCount: summary.absentCount,
            unmarkedCount: summary.unmarked,
            studentStatus: params.studentId ? statusLabel(items[0]?.attendanceStatus) : undefined,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  const topAbsentees = params.classId || params.gradeId ? reportRows.slice(0, 5) : [];
  const printedOn = todayIso();
  const canPrint = shouldRun && (reportRows.length > 0 || lessonRows.length > 0);

  const printFilters: Array<{ label: string; value: string }> = [
    { label: "שנה", value: activeYear.name },
  ];
  const filterGradeName = (grades ?? []).find((g) => g.id === params.gradeId)?.name;
  const filterClassName = (classes ?? []).find((c) => c.id === params.classId)?.name;
  const filterTrackName = (tracks ?? []).find((t) => t.id === params.trackId)?.name;
  const filterSpecName = (specializations ?? []).find(
    (s) => s.id === params.specializationId
  )?.name;
  const filterTeacherName = (teachers ?? []).find((t) => t.id === params.teacherId)
    ?.full_name;
  const selectedLessonMeta = params.lessonId ? lessonCatalog.get(params.lessonId) : undefined;
  const printTitle = singleStudentName
    ? `דוח נוכחות · ${singleStudentName} · ${activeYear.name}`
    : filterTeacherName
      ? `דוח נוכחות · ${filterTeacherName} · ${activeYear.name}`
      : `דוח נוכחות · ${activeYear.name}`;
  if (filterGradeName) printFilters.push({ label: "שכבה נוכחית", value: filterGradeName });
  if (filterClassName) printFilters.push({ label: "כיתה נוכחית", value: filterClassName });
  if (filterTrackName) printFilters.push({ label: "מסלול", value: filterTrackName });
  if (filterSpecName) printFilters.push({ label: "התמחות", value: filterSpecName });
  if (filterTeacherName) printFilters.push({ label: "מורה", value: filterTeacherName });
  if (params.subject) printFilters.push({ label: "מקצוע", value: params.subject });
  if (selectedLessonMeta) {
    printFilters.push({
      label: "שיעור",
      value: lessonOptionLabel(
        selectedLessonMeta.subject,
        selectedLessonMeta.teacherName,
        selectedLessonMeta.dayOfWeek,
        selectedLessonMeta.lessonNumber
      ),
    });
  }
  if (singleStudentName) {
    printFilters.push({ label: "תלמידה", value: singleStudentName });
  }
  printFilters.push({
    label: "סף חיסורים",
    value: selectedRule
      ? `${threshold}% (${selectedRule.name})`
      : `${threshold}%`,
  });
  if (canPrint) {
    printFilters.push({
      label: "תלמידות",
      value: reportRows.length.toLocaleString("he-IL"),
    });
  }

  // Aggregate KPI numbers
  const totals = reportRows.reduce(
    (acc, r) => {
      acc.lessons += r.totalRequired;
      acc.present += r.presentOnlyCount;
      acc.late += r.lateCount;
      acc.absent += r.absentCount;
      return acc;
    },
    { lessons: 0, present: 0, late: 0, absent: 0 }
  );
  const attendancePct =
    totals.lessons > 0
      ? Math.round(((totals.present + totals.late) / totals.lessons) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-stack_lg print:gap-4">
      {canPrint && (
        <ReportPrintHeader
          title={printTitle}
          yearName={activeYear.name}
          printedHebrew={formatHebrewDate(printedOn)}
          printedGregorian={formatGregorianDate(printedOn)}
          filters={printFilters}
        />
      )}

      <div className="print:hidden">
        <PageHeader
          title="דוחות נוכחות"
          description="שיעורים ומצב כל שיעור לפי השנה הפעילה, מורה, תלמידה או שכבה נוכחית. מופעים מוצגים רק אחרי בחירת שיעור."
          size="headline"
          actions={
            <div className="flex flex-wrap gap-2">
              <ExportCsvButton
                rows={reportRows}
                lessonRows={lessonRows}
                occurrenceRows={occurrenceRows}
                occurrenceStudentRows={occurrenceStudentRows}
                title={printTitle}
                filename={`attendance-${activeYear.name}.csv`}
              />
              <PrintButton
                label="הדפסת דוח"
                documentTitle={printTitle}
                disabled={!canPrint}
                disabledReason="יש להפיק דוח עם נתונים לפני הדפסה"
              />
            </div>
          }
        />
      </div>

      <div className="print:hidden">
        <ReportsFilter
          grades={grades ?? []}
          classes={classes ?? []}
          tracks={tracks ?? []}
          specializations={specializations ?? []}
          teachers={(teachers ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
          students={allStudents ?? []}
          subjects={subjects}
          lessons={(yearLessons ?? []).map((l) => ({
            id: l.id,
            label: lessonOptionLabel(
              l.subject,
              teacherFullName(l.teacher_teaching_assignments),
              l.day_of_week,
              l.lesson_number
            ),
          }))}
          rules={rules ?? []}
          defaults={{
            minAbsence: String(minAbsence),
            gradeId: params.gradeId,
            classId: params.classId,
            trackId: params.trackId,
            specializationId: params.specializationId,
            teacherId: params.teacherId,
            subject: params.subject,
            studentId: params.studentId,
            lessonId: params.lessonId,
            ruleId: params.ruleId,
          }}
        />
      </div>

      {!shouldRun ? (
        <Section className="print:hidden">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="filter_alt" className="text-5xl text-outline-variant" />
            <p className="font-title-lg text-title-lg text-primary">
              בחרי מסננים והפעילי את הסינון
            </p>
            <p className="max-w-md text-body-md text-on-surface-variant">
              הדוח יציג רק תלמידות שעומדות בסף החיסורים שנבחר, לפי הכיתות / מסלולים / מורים שאת בוחרת.
            </p>
          </div>
        </Section>
      ) : reportRows.length === 0 && lessonRows.length === 0 ? (
        <Section className="print:hidden">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="check_circle" className="text-5xl text-attendance-present" />
            <p className="font-title-lg text-title-lg text-primary">
              אין נתונים לדוח לפי הסינון
            </p>
            <p className="text-body-md text-on-surface-variant">
              בדקי שיש תלמידות משובצות בשנה הפעילה, או הרחיבי את הסינון.
            </p>
          </div>
        </Section>
      ) : (
        <>
          {/* KPI Grid + Top Absentees + Trend Chart */}
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3 print:grid-cols-1 print:gap-4">
            <div className="flex flex-col gap-gutter lg:col-span-1 print:col-span-1">
              <div className="grid grid-cols-2 gap-4 print:grid-cols-4 print:gap-3">
                <KpiCard
                  label="שיעורים"
                  value={lessonRows.length.toLocaleString("he-IL")}
                  icon="school"
                  accent="primary"
                />
                <KpiCard
                  label="% נוכחות"
                  value={`${attendancePct}%`}
                  icon="check_circle"
                  accent="present"
                />
                <KpiCard
                  label="איחורים"
                  value={totals.late.toLocaleString("he-IL")}
                  icon="schedule"
                  accent="late"
                />
                <KpiCard
                  label="חיסורים"
                  value={totals.absent.toLocaleString("he-IL")}
                  icon="person_off"
                  accent="absent"
                />
              </div>

              {topAbsentees.length > 0 && (
                <Section
                  icon="warning"
                  title="חריגות בולטות"
                  className="print:hidden"
                >
                  <ul className="flex flex-col divide-y divide-outline-variant/25">
                    {topAbsentees.map((r, i) => (
                      <li
                        key={r.studentId}
                        className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                      >
                        <Link
                          href={`/students/${r.studentId}`}
                          className="flex min-w-0 items-center gap-2 text-label-md text-primary hover:underline"
                        >
                          <span className="w-4 text-caption text-on-surface-variant">
                            {i + 1}.
                          </span>
                          <span className="truncate">{r.studentName}</span>
                        </Link>
                        <StatusPill
                          tone={r.ruleLevel === "blocked" ? "danger" : "warn"}
                        >
                          {r.absencePercent}% חיסורים
                        </StatusPill>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            {trendMonths.length > 0 && (
              <div className="lg:col-span-2 print:hidden">
                <Section
                  icon="trending_up"
                  title="מגמת נוכחות חודשית"
                  subtitle="ממוצע לפי סטטוס לאורך התקופה שנבחרה"
                >
                  <StudentTrendChart months={trendMonths} />
                </Section>
              </div>
            )}
          </div>

          {reportRows.length > 0 && (
          <Section
            icon="table_view"
            title={printTitle}
            subtitle={`שנה ${activeYear.name} · סף${
              selectedRule
                ? ` ${selectedRule.max_allowed_absence_percent}% (${selectedRule.name})`
                : ` ${threshold}%`
            }${selectedRule ? ` · אזהרה מ-${includeFrom}%` : ""}`}
            bodyBleed
            className="print:border-0"
            headerClassName="print:hidden"
          >
            <Table
              headers={[
                "תלמידה",
                "שכבה",
                "כיתה",
                "מופעים",
                "נוכחת",
                "איחור",
                "נעדרה",
                "לא סומן",
                "% חיסורים",
                "סטטוס",
              ]}
            >
              {reportRows.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-label-md text-label-md text-primary">
                    <Link href={`/students/${row.studentId}`} className="hover:underline">
                      {row.studentName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {row.gradeName}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {row.className}
                  </TableCell>
                  <TableCell className="text-on-surface">
                    {row.totalRequired}
                  </TableCell>
                  <TableCell className="text-attendance-present">
                    {row.presentOnlyCount}
                  </TableCell>
                  <TableCell className="text-attendance-late">
                    {row.lateCount}
                  </TableCell>
                  <TableCell className="text-attendance-absent">
                    {row.absentCount}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {row.unmarkedCount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold",
                      row.ruleLevel === "blocked" && "text-attendance-absent",
                      row.ruleLevel === "warning" && "text-attendance-late",
                      row.ruleLevel === "ok" && "text-attendance-present"
                    )}
                  >
                    {row.absencePercent}%
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      tone={
                        row.ruleLevel === "blocked"
                          ? "danger"
                          : row.ruleLevel === "warning"
                            ? "warn"
                            : "ok"
                      }
                    >
                      {row.ruleLabel}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Section>
          )}

          {lessonRows.length > 0 && (
            <Section
              icon="menu_book"
              title={params.teacherId ? "השיעורים שמלמדת" : "שיעורים ומצב כל שיעור"}
              subtitle={
                params.lessonId
                  ? "בחרי שיעור אחר כדי לחזור לרשימה, או לחצי על מופע למטה"
                  : "לחצי על שיעור כדי לראות את כל המופעים שלו"
              }
              bodyBleed
              className="print:border-0"
            >
              {params.lessonId && (
                <div className="mb-3 px-4 print:hidden">
                  <Link
                    href={buildReportHref(params, { lessonId: null })}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    ← כל השיעורים
                  </Link>
                </div>
              )}
              <Table
                headers={[
                  "מקצוע",
                  "מורה",
                  "יום",
                  "מופעים",
                  "נוכחת",
                  "איחור",
                  "נעדרה",
                  "לא סומן",
                  "% חיסורים",
                  "סטטוס",
                ]}
              >
                {lessonRows.map((row) => (
                  <TableRow
                    key={row.lessonId}
                    className={params.lessonId === row.lessonId ? "bg-primary/5" : undefined}
                  >
                    <TableCell className="font-label-md text-label-md text-primary">
                      <Link
                        href={buildReportHref(params, { lessonId: row.lessonId })}
                        className="hover:underline"
                      >
                        {row.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{row.teacherName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.dayLabel}</TableCell>
                    <TableCell className="text-on-surface">{row.totalRequired}</TableCell>
                    <TableCell className="text-attendance-present">{row.presentOnlyCount}</TableCell>
                    <TableCell className="text-attendance-late">{row.lateCount}</TableCell>
                    <TableCell className="text-attendance-absent">{row.absentCount}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.unmarkedCount}</TableCell>
                    <TableCell
                      className={cn(
                        "font-semibold",
                        row.ruleLevel === "blocked" && "text-attendance-absent",
                        row.ruleLevel === "warning" && "text-attendance-late",
                        row.ruleLevel === "ok" && "text-attendance-present"
                      )}
                    >
                      {row.absencePercent}%
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={
                          row.ruleLevel === "blocked"
                            ? "danger"
                            : row.ruleLevel === "warning"
                              ? "warn"
                              : "ok"
                        }
                      >
                        {row.ruleLabel}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            </Section>
          )}

          {params.lessonId && (
            <Section
              icon="event_repeat"
              title={
                selectedLessonMeta
                  ? `מופעים · ${selectedLessonMeta.subject}`
                  : "מופעי השיעור"
              }
              subtitle={
                params.studentId
                  ? "סטטוס התלמידה בכל מופע. לחצי על תאריך לפירוט."
                  : "לחצי על מופע כדי לראות נוכחות של כל תלמידה"
              }
              bodyBleed
              className="print:border-0"
            >
              {occurrenceRows.length === 0 ? (
                <p className="px-4 py-6 text-body-md text-on-surface-variant">
                  אין מופעים לשיעור זה בטווח השנה הפעילה.
                </p>
              ) : (
                <Table
                  headers={
                    params.studentId
                      ? ["תאריך", "סטטוס", "נוכחות"]
                      : ["תאריך", "תלמידות", "נוכחת", "איחור", "נעדרה", "לא סומן", "נוכחות"]
                  }
                >
                  {occurrenceRows.map((row) => (
                    <TableRow
                      key={row.occurrenceId}
                      className={
                        params.occurrenceId === row.occurrenceId ? "bg-primary/5" : undefined
                      }
                    >
                      <TableCell className="font-label-md text-label-md text-primary">
                        <Link
                          href={buildReportHref(params, { occurrenceId: row.occurrenceId })}
                          className="hover:underline"
                        >
                          {formatHebrewDate(row.date)}
                        </Link>
                      </TableCell>
                      {params.studentId ? (
                        <TableCell className="text-on-surface">
                          {row.studentStatus ?? "לא סומן"}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="text-on-surface">{row.totalRequired}</TableCell>
                          <TableCell className="text-attendance-present">
                            {row.presentOnlyCount}
                          </TableCell>
                          <TableCell className="text-attendance-late">{row.lateCount}</TableCell>
                          <TableCell className="text-attendance-absent">{row.absentCount}</TableCell>
                          <TableCell className="text-on-surface-variant">
                            {row.unmarkedCount}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Link
                          href={`/attendance?date=${row.date}&occurrenceId=${row.occurrenceId}`}
                          className="font-label-md text-label-md text-primary hover:underline print:hidden"
                        >
                          פתיחה
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              )}
            </Section>
          )}

          {params.occurrenceId && (
            <Section
              icon="how_to_reg"
              title="נוכחות במופע"
              subtitle={
                occurrenceRows.find((o) => o.occurrenceId === params.occurrenceId)
                  ? formatHebrewDate(
                      occurrenceRows.find((o) => o.occurrenceId === params.occurrenceId)!.date
                    )
                  : undefined
              }
              bodyBleed
              className="print:border-0"
            >
              <div className="mb-3 px-4 print:hidden">
                <Link
                  href={buildReportHref(params, { occurrenceId: null })}
                  className="font-label-md text-label-md text-primary hover:underline"
                >
                  ← כל המופעים
                </Link>
              </div>
              {occurrenceStudentRows.length === 0 ? (
                <p className="px-4 py-6 text-body-md text-on-surface-variant">
                  אין תלמידות למופע זה לפי הסינון.
                </p>
              ) : (
                <Table headers={["תלמידה", "שכבה", "כיתה", "סטטוס"]}>
                  {occurrenceStudentRows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-label-md text-label-md text-primary">
                        {row.studentName}
                      </TableCell>
                      <TableCell className="text-on-surface-variant">{row.gradeName}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.className}</TableCell>
                      <TableCell className="text-on-surface">{row.status}</TableCell>
                    </TableRow>
                  ))}
                </Table>
              )}
            </Section>
          )}
          <ReportPrintFooter studentCount={reportRows.length} />
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: "primary" | "present" | "late" | "absent";
}) {
  const accentBar: Record<typeof accent, string> = {
    primary: "border-t-transparent print:border-t-4 print:border-t-primary",
    present: "border-t-4 border-t-attendance-present",
    late: "border-t-4 border-t-attendance-late",
    absent: "border-t-4 border-t-attendance-absent",
  };
  const iconWrap: Record<typeof accent, string> = {
    primary: "bg-primary/10 text-primary",
    present: "bg-attendance-present/10 text-attendance-present",
    late: "bg-attendance-late/10 text-attendance-late",
    absent: "bg-attendance-absent/10 text-attendance-absent",
  };
  return (
    <div
      className={cn(
        "card-hover flex flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-tactile-sm print:break-inside-avoid print:p-3 print:shadow-none",
        accentBar[accent]
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">
          {label}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md print:hidden",
            iconWrap[accent]
          )}
          aria-hidden
        >
          <Icon name={icon} className="text-[20px]" />
        </div>
      </div>
      <span className="font-headline-lg text-headline-lg text-primary print:text-title-lg print:leading-7">
        {value}
      </span>
    </div>
  );
}
