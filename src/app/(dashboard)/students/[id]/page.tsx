import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { formatDate, isDateInRange } from "@/lib/dates/hebrew";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import { StudentDetailForms } from "./StudentDetailForms";
import { StudentLessonAssignments } from "./StudentLessonAssignments";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";

interface Props {
  params: { id: string };
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = params;
  const supabase = await createClient();
  const activeYear = await getActiveAcademicYear();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const { data: assignments } = await supabase
    .from("student_assignments")
    .select(
      "*, grades(name), classes(name), tracks(name), specializations(name), academic_years(name)"
    )
    .eq("student_id", id)
    .order("start_date", { ascending: false });

  let yearData = null;
  let lessons: Array<{ id: string; subject: string }> = [];
  let lessonAssignments: Array<{
    id: string;
    lesson_id: string;
    subject: string;
    assignment_type: string;
    start_date: string;
    end_date: string | null;
  }> = [];
  let subjectStats: Array<{
    subject: string;
    totalRequired: number;
    absentCount: number;
    lateCount: number;
    presentOnlyCount: number;
    presentCount: number;
    unmarked: number;
    absencePercent: number;
    maxAllowed: number | null;
    ruleName: string | null;
    ruleLabel: string;
    ruleLevel: "ok" | "warning" | "blocked";
  }> = [];
  let changeLog: Array<{
    id: string;
    changed_at: string;
    old_status: string | null;
    new_status: string | null;
    subject: string;
    occurrence_date: string;
  }> = [];

  if (activeYear) {
    const [grades, classes, tracks, specializations, yearLessons, sla] = await Promise.all([
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("specializations").select("*").eq("academic_year_id", activeYear.id),
      supabase
        .from("lessons")
        .select("id, subject")
        .eq("academic_year_id", activeYear.id)
        .order("subject"),
      supabase
        .from("student_lesson_assignments")
        .select("*, lessons!inner(id, subject, academic_year_id)")
        .eq("student_id", id)
        .eq("lessons.academic_year_id", activeYear.id)
        .order("start_date", { ascending: false }),
    ]);

    yearData = {
      year: activeYear,
      grades: grades.data ?? [],
      classes: classes.data ?? [],
      tracks: tracks.data ?? [],
      specializations: specializations.data ?? [],
    };
    lessons = yearLessons.data ?? [];
    lessonAssignments = (sla.data ?? []).map((row) => ({
      id: row.id,
      lesson_id: row.lesson_id,
      subject: (row.lessons as unknown as { subject: string }).subject,
      assignment_type: row.assignment_type,
      start_date: row.start_date,
      end_date: row.end_date,
    }));

    const lessonIds = lessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      const [{ data: occurrences }, { data: attendanceRecords }] = await Promise.all([
        supabase
          .from("lesson_occurrences")
          .select(
            "id, occurrence_date, status, lesson_id, lessons!inner(id, subject, academic_year_id, attendance_rule_id, attendance_rules(name, max_allowed_absence_percent))"
          )
          .eq("lessons.academic_year_id", activeYear.id)
          .in("lesson_id", lessonIds)
          .neq("status", "cancelled"),
        supabase.from("attendance").select("*").eq("student_id", id),
      ]);

      const yearAssignments = (assignments ?? []).filter(
        (a) => a.academic_year_id === activeYear.id
      );

      const bySubject = new Map<
        string,
        {
          rows: Array<{
            occurrenceId: string;
            occurrenceDate: string;
            status: string;
            attendanceStatus?: AttendanceStatus;
          }>;
          maxAllowed: number | null;
          ruleName: string | null;
        }
      >();

      for (const o of occurrences ?? []) {
        const date = o.occurrence_date;
        const inPlacement = yearAssignments.some((a) =>
          isDateInRange(date, a.start_date, a.end_date)
        );
        if (!inPlacement) continue;

        const hasLessonLinks = lessonAssignments.length > 0;
        const inLesson = !hasLessonLinks
          ? true
          : lessonAssignments.some(
              (la) =>
                la.lesson_id === o.lesson_id &&
                isDateInRange(date, la.start_date, la.end_date)
            );
        if (!inLesson) continue;

        const lesson = o.lessons as unknown as {
          subject: string;
          attendance_rules: { name: string; max_allowed_absence_percent: number } | null;
        } | null;
        const subject = lesson?.subject ?? "ללא";
        const rule = lesson?.attendance_rules ?? null;
        const maxAllowed =
          rule?.max_allowed_absence_percent != null
            ? Number(rule.max_allowed_absence_percent)
            : null;

        const bucket = bySubject.get(subject) ?? {
          rows: [],
          maxAllowed: null,
          ruleName: null,
        };
        bucket.rows.push({
          occurrenceId: o.id,
          occurrenceDate: date,
          status: o.status,
          attendanceStatus: attendanceRecords?.find((a) => a.lesson_occurrence_id === o.id)
            ?.status as AttendanceStatus | undefined,
        });
        if (maxAllowed != null) {
          bucket.maxAllowed =
            bucket.maxAllowed == null ? maxAllowed : Math.min(bucket.maxAllowed, maxAllowed);
          bucket.ruleName = rule?.name ?? bucket.ruleName;
        }
        bySubject.set(subject, bucket);
      }

      subjectStats = Array.from(bySubject.entries()).map(([subject, bucket]) => {
        const summary = summarizeAttendance(bucket.rows);
        const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, bucket.maxAllowed);
        return {
          subject,
          ...summary,
          maxAllowed: bucket.maxAllowed,
          ruleName: bucket.ruleName,
          ruleLabel: evaluated.label,
          ruleLevel: evaluated.level,
        };
      });

      const attendanceIds = (attendanceRecords ?? []).map((a) => a.id);
      if (attendanceIds.length > 0) {
        const { data: logs } = await supabase
          .from("attendance_change_log")
          .select("id, changed_at, old_status, new_status, attendance_id")
          .in("attendance_id", attendanceIds)
          .order("changed_at", { ascending: false })
          .limit(30);

        const occByAttendance = new Map(
          (attendanceRecords ?? []).map((a) => [a.id, a.lesson_occurrence_id])
        );
        const occMap = new Map(
          (occurrences ?? []).map((o) => [
            o.id,
            {
              subject: (o.lessons as unknown as { subject: string } | null)?.subject ?? "",
              date: o.occurrence_date,
            },
          ])
        );

        changeLog = (logs ?? []).map((log) => {
          const occId = occByAttendance.get(log.attendance_id);
          const occ = occId ? occMap.get(occId) : undefined;
          return {
            id: log.id,
            changed_at: log.changed_at,
            old_status: log.old_status,
            new_status: log.new_status,
            subject: occ?.subject ?? "",
            occurrence_date: occ?.date ?? "",
          };
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.full_name}
        description={`ת"ז ${student.identity_number} · מחזור ${student.cohort_number ?? "—"} · ${student.is_active ? "פעילה" : "לא פעילה"}`}
        actions={<PrintButton />}
      />

      {yearData && (
        <Card title="העברה" className="print:hidden">
          <StudentDetailForms studentId={id} yearData={yearData} />
        </Card>
      )}

      <Card title="היסטוריית העברות">
        <Table headers={["שנה", "שכבה", "כיתה", "מסלול", "התמחות", "מתאריך", "עד תאריך"]}>
          {(assignments ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                {(a.academic_years as unknown as { name: string } | null)?.name}
              </TableCell>
              <TableCell>{(a.grades as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>{(a.classes as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>{(a.tracks as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>
                {(a.specializations as unknown as { name: string } | null)?.name ?? "-"}
              </TableCell>
              <TableCell>{formatDate(a.start_date)}</TableCell>
              <TableCell>{a.end_date ? formatDate(a.end_date) : "נוכחי"}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>

      {activeYear && (
        <Card title="שיוך לשיעורים">
          <StudentLessonAssignments
            studentId={id}
            lessons={lessons}
            assignments={lessonAssignments}
          />
        </Card>
      )}

      <Card title="אחוזי נוכחות לפי מקצוע">
        {subjectStats.length === 0 ? (
          <p className="text-sm text-slate-500">אין נתוני נוכחות לחישוב עדיין.</p>
        ) : (
          <Table headers={["מקצוע", "שיעורים", "נוכחת", "איחור", "נעדרה", "אחוז היעדרות", "סטטוס לפי כלל"]}>
            {subjectStats.map((row) => (
              <TableRow key={row.subject}>
                <TableCell>{row.subject}</TableCell>
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
                  {row.maxAllowed != null ? ` / ${row.maxAllowed}%` : ""}
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
                  {row.ruleName ? ` · ${row.ruleName}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <Card title="יומן שינויי נוכחות">
        {changeLog.length === 0 ? (
          <p className="text-sm text-slate-500">אין שינויים רשומים.</p>
        ) : (
          <Table headers={["תאריך שינוי", "שיעור", "יום שיעור", "מ", "אל"]}>
            {changeLog.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDate(log.changed_at.slice(0, 10))}</TableCell>
                <TableCell>{log.subject}</TableCell>
                <TableCell>
                  {log.occurrence_date ? formatDate(log.occurrence_date) : "—"}
                </TableCell>
                <TableCell>{log.old_status ?? "—"}</TableCell>
                <TableCell>{log.new_status ?? "—"}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
