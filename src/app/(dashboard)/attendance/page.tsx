import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { addDays } from "@/lib/dates/hebrew";
import { formatHebrewDate, toIsoDate } from "@/lib/dates/hebrew";
import { AttendanceJournal } from "./AttendanceJournal";

interface Props {
  searchParams: { week?: string; classId?: string };
}

function getWeekStart(dateStr?: string): string {
  const d = dateStr
    ? (() => {
        const [y, m, day] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, day, 12, 0, 0);
      })()
    : new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toIsoDate(d);
}

export default async function AttendancePage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader title="יומן נוכחות" description="יש להגדיר שנה אקדמית פעילה." />
      </div>
    );
  }

  const weekStart = getWeekStart(params.week);
  const weekEnd = addDays(weekStart, 6);
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
      <PageHeader
        title="יומן נוכחות"
        description="לחיצה על תא משנה: נוכחת → נעדרה → איחור. איחור נספר כנוכחות."
      />

      {unmarkedOccurrences.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unmarkedOccurrences.length} שיעורים השבוע עדיין בלי רישום מלא.
        </div>
      )}

      <AttendanceJournal
        weekStart={weekStart}
        weekLabel={`${formatHebrewDate(weekStart)} – ${formatHebrewDate(weekEnd)}`}
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
    </div>
  );
}
