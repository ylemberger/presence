import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { isDateInRange, formatDate } from "@/lib/dates/hebrew";
import { summarizeAttendance } from "@/lib/attendance/calculator";
import { ReportsFilter } from "./ReportsFilter";
import { PrintButton } from "@/components/ui/PrintButton";
import { todayIso } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";

interface Props {
  searchParams: {
    classId?: string;
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
  const shouldRun = params.run === "1" || Boolean(params.classId || params.studentId);

  const [{ data: classes }, { data: allStudents }, { data: rules }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("academic_year_id", activeYear.id),
    supabase.from("students").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("attendance_rules").select("id, name, max_allowed_absence_percent").order("name"),
  ]);

  const selectedRule = (rules ?? []).find((r) => r.id === params.ruleId);
  const threshold = selectedRule
    ? Number(selectedRule.max_allowed_absence_percent)
    : minAbsence;

  let reportRows: Array<{
    studentId: string;
    studentName: string;
    className: string;
    totalRequired: number;
    presentOnlyCount: number;
    lateCount: number;
    absentCount: number;
    absencePercent: number;
  }> = [];

  if (shouldRun) {
    let studentIds: string[] = [];

    if (params.studentId) {
      studentIds = [params.studentId];
    } else if (params.classId) {
      const { data: assignments } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("academic_year_id", activeYear.id)
        .eq("class_id", params.classId);
      studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];
    } else {
      const { data: assignments } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("academic_year_id", activeYear.id);
      studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];
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

        const eligible = (occurrences ?? []).filter((o) => {
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
        if (summary.absencePercent < threshold) continue;

        const currentAssignment =
          studentAssignments.find((a) => !a.end_date) ?? studentAssignments[0];
        const className =
          (currentAssignment?.classes as unknown as { name: string } | null)?.name ?? "-";

        reportRows.push({
          studentId,
          studentName,
          className,
          totalRequired: summary.totalRequired,
          presentOnlyCount: summary.presentOnlyCount,
          lateCount: summary.lateCount,
          absentCount: summary.absentCount,
          absencePercent: summary.absencePercent,
        });
      }

      reportRows.sort((a, b) => b.absencePercent - a.absencePercent);
    }
  }

  return (
    <div>
      <PageHeader
        title="דוחות נוכחות"
        description="סינון לפי כיתה, תלמידה, טווח תאריכים עברי וסף היעדרות."
        actions={<PrintButton />}
      />

      <div className="print:hidden mb-6">
        <ReportsFilter
          classes={classes ?? []}
          students={allStudents ?? []}
          rules={rules ?? []}
          defaults={{
            startDate,
            endDate,
            minAbsence: String(minAbsence),
            classId: params.classId,
            studentId: params.studentId,
            ruleId: params.ruleId,
          }}
        />
      </div>

      <Card title={`דוח נוכחות: ${formatDate(startDate)} — ${formatDate(endDate)}`}>
        {!shouldRun ? (
          <p className="text-slate-600">בחרי מסננים ולחצי «הצג דוח». ניתן להשאיר «כל הכיתות».</p>
        ) : reportRows.length === 0 ? (
          <p className="text-slate-600">לא נמצאו תוצאות לטווח ולסף שנבחרו.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
              <div>שיעורים שהתקיימו: {reportRows.reduce((s, r) => s + r.totalRequired, 0)}</div>
              <div>נוכחות: {reportRows.reduce((s, r) => s + r.presentOnlyCount, 0)}</div>
              <div>איחורים: {reportRows.reduce((s, r) => s + r.lateCount, 0)}</div>
              <div>היעדרויות: {reportRows.reduce((s, r) => s + r.absentCount, 0)}</div>
              <div>
                סף מותר:{" "}
                {selectedRule
                  ? `${selectedRule.max_allowed_absence_percent}% (${selectedRule.name})`
                  : `${threshold}%`}
              </div>
            </div>
            <Table
              headers={[
                "תלמידה",
                "כיתה",
                "שיעורים",
                "נוכחת",
                "איחור",
                "נעדרה",
                "אחוז היעדרות",
              ]}
            >
              {reportRows.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell>{row.studentName}</TableCell>
                  <TableCell>{row.className}</TableCell>
                  <TableCell>{row.totalRequired}</TableCell>
                  <TableCell>{row.presentOnlyCount}</TableCell>
                  <TableCell>{row.lateCount}</TableCell>
                  <TableCell>{row.absentCount}</TableCell>
                  <TableCell
                    className={
                      row.absencePercent > (selectedRule?.max_allowed_absence_percent ?? threshold)
                        ? "font-bold text-rose-600"
                        : ""
                    }
                  >
                    {row.absencePercent}%
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
