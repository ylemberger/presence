import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader, StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { isDateInRange, formatHebrewDate, formatGregorianDate } from "@/lib/dates/hebrew";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import { ReportsFilter } from "./ReportsFilter";
import { PrintButton } from "@/components/ui/PrintButton";
import { ExportCsvButton } from "./ExportCsvButton";
import { StudentTrendChart } from "./StudentTrendChart";
import { todayIso } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface Props {
  searchParams: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    startDate?: string;
    endDate?: string;
    minAbsence?: string;
    ruleId?: string;
    run?: string;
  };
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

  const startDate = params.startDate ?? activeYear.created_at.split("T")[0];
  const endDate = params.endDate ?? todayIso();
  const minAbsence = params.minAbsence ? parseFloat(params.minAbsence) : 0;
  const shouldRun =
    params.run === "1" ||
    Boolean(
      params.classId ||
        params.trackId ||
        params.specializationId ||
        params.teacherId ||
        params.subject ||
        params.studentId
    );

  const [
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: yearLessons },
    { data: allStudents },
    { data: rules },
  ] = await Promise.all([
    supabase.from("classes").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
    supabase.from("tracks").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
    supabase
      .from("specializations")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    supabase
      .from("lessons")
      .select("id, subject, class_id, track_id, specialization_id, teacher_teaching_assignment_id")
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
    className: string;
    totalRequired: number;
    presentOnlyCount: number;
    lateCount: number;
    absentCount: number;
    absencePercent: number;
    ruleLabel: string;
    ruleLevel: "ok" | "warning" | "blocked";
  }> = [];

  let trendMonths: Array<{
    label: string;
    present: number;
    late: number;
    absent: number;
  }> = [];

  let singleStudentName: string | null = null;

  if (shouldRun) {
    let scopedLessonIds: string[] | null = null;
    let lessons = yearLessons ?? [];

    if (params.teacherId) {
      const { data: tas } = await supabase
        .from("teacher_teaching_assignments")
        .select("id")
        .eq("teacher_id", params.teacherId)
        .eq("academic_year_id", activeYear.id);
      const taIds = new Set((tas ?? []).map((t) => t.id));
      lessons = lessons.filter((l) => taIds.has(l.teacher_teaching_assignment_id));
    }
    if (params.subject) {
      lessons = lessons.filter((l) => l.subject === params.subject);
    }
    if (params.classId) {
      lessons = lessons.filter((l) => !l.class_id || l.class_id === params.classId);
    }
    if (params.trackId) {
      lessons = lessons.filter((l) => !l.track_id || l.track_id === params.trackId);
    }
    if (params.specializationId) {
      lessons = lessons.filter(
        (l) => !l.specialization_id || l.specialization_id === params.specializationId
      );
    }
    if (
      params.teacherId ||
      params.subject ||
      (params.classId && lessons.some((l) => l.class_id)) ||
      params.trackId ||
      params.specializationId
    ) {
      scopedLessonIds = lessons.map((l) => l.id);
    }

    let studentIds: string[] = [];
    if (params.studentId) {
      studentIds = [params.studentId];
    } else {
      let q = supabase
        .from("student_assignments")
        .select("student_id")
        .eq("academic_year_id", activeYear.id);
      if (params.classId) q = q.eq("class_id", params.classId);
      if (params.trackId) q = q.eq("track_id", params.trackId);
      if (params.specializationId) q = q.eq("specialization_id", params.specializationId);
      const { data: assignments } = await q;
      studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];

      if (params.teacherId || params.subject) {
        const { data: links } = await supabase
          .from("student_lesson_assignments")
          .select("student_id, lesson_id")
          .in("lesson_id", scopedLessonIds?.length ? scopedLessonIds : ["00000000-0000-0000-0000-000000000000"])
          .is("end_date", null);
        const fromLessons = new Set((links ?? []).map((l) => l.student_id));
        studentIds = studentIds.filter((id) => fromLessons.has(id));
      }
    }

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
          .select("*, classes(name)")
          .eq("academic_year_id", activeYear.id)
          .in("student_id", studentIds),
        supabase
          .from("student_lesson_assignments")
          .select("*, lessons!inner(academic_year_id)")
          .eq("lessons.academic_year_id", activeYear.id)
          .in("student_id", studentIds),
        supabase
          .from("lesson_occurrences")
          .select("id, occurrence_date, status, lesson_id, lessons!inner(academic_year_id)")
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
          status: o.status,
          attendanceStatus: studentAttendance.find((a) => a.lesson_occurrence_id === o.id)
            ?.status as AttendanceStatus | undefined,
        }));

        const summary = summarizeAttendance(eligibleWithAttendance);
        const isSingleFocus = Boolean(params.studentId && studentId === params.studentId);
        if (!isSingleFocus && summary.absencePercent < includeFrom) continue;

        const currentAssignment =
          studentAssignments.find((a) => !a.end_date) ?? studentAssignments[0];
        const className =
          (currentAssignment?.classes as unknown as { name: string } | null)?.name ?? "-";
        const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, threshold);

        reportRows.push({
          studentId,
          studentName,
          className,
          totalRequired: summary.totalRequired,
          presentOnlyCount: summary.presentOnlyCount,
          lateCount: summary.lateCount,
          absentCount: summary.absentCount,
          absencePercent: summary.absencePercent,
          ruleLabel: evaluated.label,
          ruleLevel: evaluated.level,
        });

        if (params.studentId && studentId === params.studentId) {
          singleStudentName = studentName;
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
    }
  }

  const topAbsentees = params.classId ? reportRows.slice(0, 5) : [];
  const printTitle = singleStudentName
    ? `דוח נוכחות עבור ${singleStudentName}`
    : `דוח נוכחות: ${formatHebrewDate(startDate)} – ${formatHebrewDate(endDate)}`;

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
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="דוחות נוכחות"
        description="ניתוח וצפייה בנתוני הגעה וחיסורים · הדפסה בלי הערות פנימיות."
        size="headline"
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <ExportCsvButton
              rows={reportRows}
              title={printTitle}
              filename={`attendance-${startDate}-${endDate}.csv`}
            />
            <PrintButton />
          </div>
        }
      />

      <div className="print:hidden">
        <ReportsFilter
          classes={classes ?? []}
          tracks={tracks ?? []}
          specializations={specializations ?? []}
          teachers={(teachers ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
          students={allStudents ?? []}
          subjects={subjects}
          rules={rules ?? []}
          defaults={{
            startDate,
            endDate,
            minAbsence: String(minAbsence),
            classId: params.classId,
            trackId: params.trackId,
            specializationId: params.specializationId,
            teacherId: params.teacherId,
            subject: params.subject,
            studentId: params.studentId,
            ruleId: params.ruleId,
          }}
        />
      </div>

      {/* Print-only header */}
      <div className="hidden text-body-md text-on-surface-variant print:block">
        <p>
          תקופה: {formatHebrewDate(startDate)} – {formatHebrewDate(endDate)} (
          {formatGregorianDate(startDate)} – {formatGregorianDate(endDate)})
        </p>
        <p className="mt-1">תאריך הדפסה: {formatGregorianDate(todayIso())}</p>
        <p className="mt-6">חתימת מורה / רכזת: ________________________</p>
      </div>

      {!shouldRun ? (
        <Section>
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
      ) : reportRows.length === 0 ? (
        <Section>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="check_circle" className="text-5xl text-attendance-present" />
            <p className="font-title-lg text-title-lg text-primary">
              אין תלמידות חורגות בטווח שנבחר
            </p>
            <p className="text-body-md text-on-surface-variant">
              נסי להרחיב את הטווח או להוריד את הסף כדי לראות תלמידות במעקב.
            </p>
          </div>
        </Section>
      ) : (
        <>
          {/* KPI Grid + Top Absentees + Trend Chart */}
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
            <div className="flex flex-col gap-gutter lg:col-span-1">
              <div className="grid grid-cols-2 gap-4">
                <KpiCard
                  label='סה"כ שיעורים'
                  value={totals.lessons.toLocaleString("he-IL")}
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

          {/* Data Table */}
          <Section
            icon="table_view"
            title={printTitle}
            subtitle={`טווח לועזי: ${formatGregorianDate(startDate)} – ${formatGregorianDate(endDate)} · סף${
              selectedRule
                ? ` ${selectedRule.max_allowed_absence_percent}% (${selectedRule.name})`
                : ` ${threshold}%`
            }${selectedRule ? ` · אזהרה מ-${includeFrom}%` : ""}`}
            bodyBleed
          >
            <Table
              headers={[
                "תלמידה",
                "כיתה",
                "שיעורים",
                "נוכחת",
                "איחור",
                "נעדרה",
                "% חיסורים",
                "סטטוס",
              ]}
            >
              {reportRows.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-label-md text-label-md text-primary">
                    {row.studentName}
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
    primary: "border-t-transparent",
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
        "card-hover flex flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-tactile-sm",
        accentBar[accent]
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">
          {label}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            iconWrap[accent]
          )}
          aria-hidden
        >
          <Icon name={icon} className="text-[20px]" />
        </div>
      </div>
      <span className="font-headline-lg text-headline-lg text-primary">{value}</span>
    </div>
  );
}
