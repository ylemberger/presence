import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { isDateInRange, formatHebrewDate, formatGregorianDate } from "@/lib/dates/hebrew";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import { ReportsFilter } from "./ReportsFilter";
import { PrintButton } from "@/components/ui/PrintButton";
import { todayIso } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";

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
        if (summary.absencePercent < threshold) continue;

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
      }

      reportRows.sort((a, b) => b.absencePercent - a.absencePercent);
    }
  }

  return (
    <div>
      <PageHeader
        title="דוחות נוכחות"
        description="סינון לפי כיתה / מסלול / התמחות / מורה / מקצוע. הדפסה בלי הערות פנימיות."
        actions={<PrintButton />}
      />

      <div className="print:hidden mb-6">
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

      <Card
        title={`דוח נוכחות: ${formatHebrewDate(startDate)} – ${formatHebrewDate(endDate)}`}
      >
        <p className="mb-3 text-xs text-slate-400 print:hidden">
          לועזי: {formatGregorianDate(startDate)} – {formatGregorianDate(endDate)}
        </p>
        {!shouldRun ? (
          <p className="text-slate-600">בחרי מסננים ולחצי «הצג דוח».</p>
        ) : reportRows.length === 0 ? (
          <p className="text-slate-600">לא נמצאו תוצאות לטווח ולסף שנבחרו.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
              <div>שיעורים: {reportRows.reduce((s, r) => s + r.totalRequired, 0)}</div>
              <div>נוכחות: {reportRows.reduce((s, r) => s + r.presentOnlyCount, 0)}</div>
              <div>איחורים: {reportRows.reduce((s, r) => s + r.lateCount, 0)}</div>
              <div>היעדרויות: {reportRows.reduce((s, r) => s + r.absentCount, 0)}</div>
              <div>
                סף:{" "}
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
                "סטטוס",
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
                    className={cn(
                      row.ruleLevel === "blocked" && "font-bold text-rose-600",
                      row.ruleLevel === "warning" && "font-semibold text-amber-700"
                    )}
                  >
                    {row.absencePercent}%
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      row.ruleLevel === "blocked" && "font-bold text-rose-700",
                      row.ruleLevel === "warning" && "text-amber-700",
                      row.ruleLevel === "ok" && "text-emerald-700"
                    )}
                  >
                    {row.ruleLabel}
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
