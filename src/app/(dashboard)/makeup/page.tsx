import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { getActiveAcademicYear } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import { isDateInRange } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { MakeupForms } from "./MakeupForms";

export default async function MakeupPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader title="מבחני השלמה" description="יש להגדיר שנה אקדמית פעילה." />
      </div>
    );
  }

  const [
    { data: existing },
    { data: students },
    { data: lessons },
    { data: placements },
    { data: lessonLinks },
    { data: occurrences },
    { data: attendance },
  ] = await Promise.all([
    supabase
      .from("makeup_exams")
      .select(
        "*, students(full_name), lessons(subject, attendance_rule_id, attendance_rules(name, max_allowed_absence_percent))"
      )
      .eq("academic_year_id", activeYear.id)
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("lessons")
      .select("id, subject, attendance_rule_id, attendance_rules(max_allowed_absence_percent)")
      .eq("academic_year_id", activeYear.id)
      .order("subject"),
    supabase
      .from("student_assignments")
      .select("student_id, start_date, end_date")
      .eq("academic_year_id", activeYear.id),
    supabase
      .from("student_lesson_assignments")
      .select("student_id, lesson_id, start_date, end_date, lessons!inner(academic_year_id)")
      .eq("lessons.academic_year_id", activeYear.id)
      .is("end_date", null),
    supabase
      .from("lesson_occurrences")
      .select("id, occurrence_date, status, lesson_id, lessons!inner(academic_year_id)")
      .eq("lessons.academic_year_id", activeYear.id)
      .neq("status", "cancelled"),
    supabase.from("attendance").select("student_id, lesson_occurrence_id, status"),
  ]);

  const suggestions: Array<{
    studentId: string;
    studentName: string;
    lessonId: string;
    subject: string;
    absencePercent: number;
    maxAllowed: number;
    requiredExams: number;
    label: string;
  }> = [];

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.student_id}::${e.lesson_id}`)
  );
  const studentName = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const attendanceByStudent = new Map<string, typeof attendance>();
  for (const a of attendance ?? []) {
    const list = attendanceByStudent.get(a.student_id) ?? [];
    list.push(a);
    attendanceByStudent.set(a.student_id, list);
  }

  for (const link of lessonLinks ?? []) {
    const lesson = (lessons ?? []).find((l) => l.id === link.lesson_id);
    if (!lesson) continue;
    const max =
      Number(
        (lesson.attendance_rules as unknown as { max_allowed_absence_percent: number } | null)
          ?.max_allowed_absence_percent
      ) || 20;

    const studentAtt = attendanceByStudent.get(link.student_id) ?? [];
    const studentPlacements = (placements ?? []).filter((p) => p.student_id === link.student_id);
    const eligible = (occurrences ?? [])
      .filter((o) => o.lesson_id === link.lesson_id)
      .filter((o) => {
        const date = o.occurrence_date;
        const inPlacement = studentPlacements.some((p) =>
          isDateInRange(date, p.start_date, p.end_date)
        );
        const inLesson = isDateInRange(date, link.start_date, link.end_date);
        return inPlacement && inLesson;
      })
      .map((o) => ({
        occurrenceId: o.id,
        occurrenceDate: o.occurrence_date,
        status: o.status,
        attendanceStatus: studentAtt.find((a) => a.lesson_occurrence_id === o.id)?.status as
          | AttendanceStatus
          | undefined,
      }));

    const summary = summarizeAttendance(eligible);
    if (summary.totalRequired === 0) continue;
    const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, max);
    let requiredExams = 0;
    if (evaluated.isExceeded) requiredExams = summary.absencePercent >= max * 1.5 ? 2 : 1;
    else if (summary.absencePercent >= max * 0.8) requiredExams = 1;
    if (requiredExams === 0) continue;

    const key = `${link.student_id}::${link.lesson_id}`;
    if (existingKeys.has(key)) continue;

    suggestions.push({
      studentId: link.student_id,
      studentName: studentName.get(link.student_id) ?? "תלמידה",
      lessonId: link.lesson_id,
      subject: lesson.subject,
      absencePercent: summary.absencePercent,
      maxAllowed: max,
      requiredExams,
      label: evaluated.label,
    });
  }

  suggestions.sort((a, b) => b.absencePercent - a.absencePercent);

  return (
    <div className="space-y-6">
      <PageHeader
        title="מבחני השלמה"
        description="לפי אחוזי היעדרות מול כלל השיעור. אפשר לפתוח ידנית או מההצעות האוטומטיות."
      />

      <Card title="פתיחת מבחן השלמה">
        <MakeupForms
          yearId={activeYear.id}
          students={students ?? []}
          lessons={(lessons ?? []).map((l) => ({ id: l.id, subject: l.subject }))}
        />
      </Card>

      <Card title="הצעות לפי אחוזי היעדרות">
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">אין הצעות חדשות כרגע.</p>
        ) : (
          <Table headers={["תלמידה", "שיעור", "היעדרות", "סף", "מומלץ", ""]}>
            {suggestions.slice(0, 40).map((s) => (
              <TableRow key={`${s.studentId}-${s.lessonId}`}>
                <TableCell>{s.studentName}</TableCell>
                <TableCell>{s.subject}</TableCell>
                <TableCell>{s.absencePercent}%</TableCell>
                <TableCell>{s.maxAllowed}%</TableCell>
                <TableCell>
                  {s.requiredExams} מבחן/ים · {s.label}
                </TableCell>
                <TableCell>
                  <MakeupForms
                    yearId={activeYear.id}
                    students={[{ id: s.studentId, full_name: s.studentName }]}
                    lessons={[{ id: s.lessonId, subject: s.subject }]}
                    preset={{
                      studentId: s.studentId,
                      lessonId: s.lessonId,
                      requiredExams: s.requiredExams,
                    }}
                    compact
                  />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <Card title="רשימת מבחני השלמה">
        {(existing ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">עדיין אין רשומות.</p>
        ) : (
          <Table headers={["תלמידה", "שיעור", "נדרש", "הושלם", "סטטוס", "עדכון"]}>
            {(existing ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {(row.students as unknown as { full_name: string } | null)?.full_name ?? "—"}
                </TableCell>
                <TableCell>
                  {(row.lessons as unknown as { subject: string } | null)?.subject ?? "—"}
                </TableCell>
                <TableCell>{row.required_exams}</TableCell>
                <TableCell>{row.completed_exams}</TableCell>
                <TableCell>
                  {row.status === "open"
                    ? "פתוח"
                    : row.status === "done"
                      ? "הושלם"
                      : "חסום"}
                </TableCell>
                <TableCell>
                  <MakeupForms
                    yearId={activeYear.id}
                    students={[]}
                    lessons={[]}
                    editId={row.id}
                    editDefaults={{
                      required_exams: row.required_exams,
                      completed_exams: row.completed_exams,
                      status: row.status,
                      notes: row.notes ?? "",
                    }}
                    compact
                  />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
