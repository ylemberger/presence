import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { summarizeAttendance } from "@/lib/attendance/calculator";
import { isDateInRange } from "@/lib/utils";
import { ReportsFilter } from "./ReportsFilter";
import { PrintButton } from "@/components/ui/PrintButton";

interface Props {
  searchParams: {
    classId?: string;
    studentId?: string;
    startDate?: string;
    endDate?: string;
    minAbsence?: string;
  };
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דוחות</h1>
        <p className="mt-4 text-gray-600">יש להגדיר שנה אקדמית פעילה.</p>
      </div>
    );
  }

  const startDate = params.startDate ?? activeYear.created_at.split("T")[0];
  const endDate = params.endDate ?? new Date().toISOString().split("T")[0];
  const minAbsence = params.minAbsence ? parseFloat(params.minAbsence) : 0;

  const [{ data: classes }, { data: allStudents }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("academic_year_id", activeYear.id),
    supabase.from("students").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  let reportRows: Array<{
    studentName: string;
    className: string;
    totalRequired: number;
    absentCount: number;
    absencePercent: number;
  }> = [];

  if (params.classId || params.studentId) {
    let studentIds: string[] = [];

    if (params.studentId) {
      studentIds = [params.studentId];
    } else if (params.classId) {
      const { data: assignments } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("academic_year_id", activeYear.id)
        .eq("class_id", params.classId);
      studentIds = (assignments ?? []).map((a) => a.student_id);
    }

    for (const studentId of studentIds) {
      const { data: student } = await supabase
        .from("students")
        .select("full_name")
        .eq("id", studentId)
        .single();
      if (!student) continue;

      const { data: assignments } = await supabase
        .from("student_assignments")
        .select("*")
        .eq("student_id", studentId)
        .eq("academic_year_id", activeYear.id);

      const { data: lessonAssignments } = await supabase
        .from("student_lesson_assignments")
        .select("*, lessons!inner(academic_year_id)")
        .eq("student_id", studentId)
        .eq("lessons.academic_year_id", activeYear.id);

      const { data: occurrences } = await supabase
        .from("lesson_occurrences")
        .select("id, occurrence_date, status, lesson_id, lessons!inner(academic_year_id)")
        .eq("lessons.academic_year_id", activeYear.id)
        .gte("occurrence_date", startDate)
        .lte("occurrence_date", endDate)
        .neq("status", "cancelled");

      const { data: attendanceRecords } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId);

      const eligible = (occurrences ?? []).filter((o) => {
        const date = o.occurrence_date;
        const inAssignment = (assignments ?? []).some((a) =>
          isDateInRange(date, a.start_date, a.end_date)
        );
        const inLesson =
          !lessonAssignments?.length ||
          lessonAssignments.some((la) => isDateInRange(date, la.start_date, la.end_date));
        return inAssignment && inLesson;
      });

      const eligibleWithAttendance = eligible.map((o) => ({
        occurrenceId: o.id,
        occurrenceDate: o.occurrence_date,
        status: o.status,
        attendanceStatus: attendanceRecords?.find((a) => a.lesson_occurrence_id === o.id)
          ?.status as "present" | "absent" | "late" | undefined,
      }));

      const summary = summarizeAttendance(eligibleWithAttendance);

      if (summary.absencePercent >= minAbsence) {
        const currentAssignment = (assignments ?? []).find((a) => !a.end_date);
        let className = "-";
        if (currentAssignment) {
          const { data: cls } = await supabase
            .from("classes")
            .select("name")
            .eq("id", currentAssignment.class_id)
            .single();
          className = cls?.name ?? "-";
        }

        reportRows.push({
          studentName: student.full_name,
          className,
          totalRequired: summary.totalRequired,
          absentCount: summary.absentCount,
          absencePercent: summary.absencePercent,
        });
      }
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">דוחות נוכחות</h1>

      <div className="print:hidden mb-6">
        <ReportsFilter
          classes={classes ?? []}
          students={allStudents ?? []}
          defaults={{ startDate, endDate, minAbsence: String(minAbsence) }}
        />
      </div>

      <Card title={`דוח נוכחות: ${startDate} — ${endDate}`}>
        {reportRows.length === 0 ? (
          <p className="text-gray-600">בחרי כיתה או תלמידה והפעילי חיפוש.</p>
        ) : (
          <Table headers={["תלמידה", "כיתה", "שיעורים נדרשים", "היעדרויות", "אחוז היעדרות"]}>
            {reportRows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.studentName}</TableCell>
                <TableCell>{row.className}</TableCell>
                <TableCell>{row.totalRequired}</TableCell>
                <TableCell>{row.absentCount}</TableCell>
                <TableCell
                  className={
                    row.absencePercent > 15 ? "font-bold text-red-600" : ""
                  }
                >
                  {row.absencePercent}%
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <div className="print:hidden mt-4">
        <PrintButton />
      </div>
    </div>
  );
}
