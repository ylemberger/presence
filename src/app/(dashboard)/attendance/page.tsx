import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { AttendanceJournal } from "./AttendanceJournal";

interface Props {
  searchParams: { week?: string; classId?: string };
}

function getWeekStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function AttendancePage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">נוכחות</h1>
        <p className="mt-4 text-gray-600">יש להגדיר שנה אקדמית פעילה.</p>
      </div>
    );
  }

  const weekStart = getWeekStart(params.week);
  const weekEnd = addDaysToDate(weekStart, 6);
  const classId = params.classId;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("academic_year_id", activeYear.id)
    .order("name");

  let students: Array<{ id: string; full_name: string }> = [];
  if (classId) {
    const { data: assignments } = await supabase
      .from("student_assignments")
      .select("student_id, students(id, full_name)")
      .eq("academic_year_id", activeYear.id)
      .eq("class_id", classId)
      .is("end_date", null);
    students = (assignments ?? [])
      .map((a) => {
        const s = a.students as unknown as { id: string; full_name: string } | null;
        return s;
      })
      .filter((s): s is { id: string; full_name: string } => Boolean(s));
  }

  const { data: occurrences } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, status, lesson_id, lessons!inner(subject, class_id, academic_year_id)")
    .eq("lessons.academic_year_id", activeYear.id)
    .gte("occurrence_date", weekStart)
    .lte("occurrence_date", weekEnd)
    .neq("status", "cancelled")
    .order("occurrence_date");

  const filteredOccurrences = classId
    ? (occurrences ?? []).filter((o) => {
        const lesson = o.lessons as unknown as { class_id: string | null };
        return lesson?.class_id === classId;
      })
    : occurrences ?? [];

  const occurrenceIds = filteredOccurrences.map((o) => o.id);
  let attendanceRecords: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: string;
  }> = [];

  if (occurrenceIds.length > 0 && students.length > 0) {
    const { data } = await supabase
      .from("attendance")
      .select("student_id, lesson_occurrence_id, status")
      .in("lesson_occurrence_id", occurrenceIds);
    attendanceRecords = data ?? [];
  }

  const unmarkedOccurrences = filteredOccurrences.filter((o) => {
    const marked = attendanceRecords.filter((a) => a.lesson_occurrence_id === o.id);
    return students.length > 0 && marked.length < students.length;
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">יומן נוכחות</h1>

      {unmarkedOccurrences.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          אזהרה: {unmarkedOccurrences.length} מופעי שיעור ללא רישום נוכחות מלא השבוע.
        </div>
      )}

      <Card>
        <AttendanceJournal
          weekStart={weekStart}
          classes={classes ?? []}
          selectedClassId={classId}
          students={students}
          occurrences={filteredOccurrences.map((o) => {
            const lesson = o.lessons as unknown as { subject: string };
            return {
              id: o.id,
              date: o.occurrence_date,
              subject: lesson?.subject ?? "",
            };
          })}
          attendance={attendanceRecords}
        />
      </Card>
    </div>
  );
}
