import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { addDays, formatHebrewDate, toIsoDate } from "@/lib/dates/hebrew";
import { AttendanceBoard, type AttendanceMode, type AttendanceView } from "./AttendanceBoard";

interface Props {
  searchParams: {
    mode?: string;
    view?: string;
    week?: string;
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    occurrenceId?: string;
  };
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
        <PageHeader title="נוכחות" description="יש להגדיר שנה אקדמית פעילה." />
      </div>
    );
  }

  const mode: AttendanceMode = params.mode === "single" ? "single" : "group";
  const view: AttendanceView =
    params.view === "lesson" ||
    params.view === "teacher" ||
    params.view === "group" ||
    params.view === "date"
      ? params.view
      : "date";

  const weekStart = getWeekStart(params.week);
  const weekEnd = addDays(weekStart, 6);

  const [
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: yearStudents },
    { data: occurrencesRaw },
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
      .from("student_assignments")
      .select("student_id, class_id, track_id, specialization_id, students(id, full_name, is_active)")
      .eq("academic_year_id", activeYear.id)
      .is("end_date", null),
    supabase
      .from("lesson_occurrences")
      .select(
        `id, occurrence_date, lesson_id,
         lessons!inner(
           id, subject, class_id, track_id, specialization_id, academic_year_id,
           teacher_teaching_assignments(teacher_id, teachers(full_name))
         )`
      )
      .eq("lessons.academic_year_id", activeYear.id)
      .gte("occurrence_date", weekStart)
      .lte("occurrence_date", weekEnd)
      .neq("status", "cancelled")
      .order("occurrence_date"),
  ]);

  let assignmentRows = yearStudents ?? [];
  if (params.classId) {
    assignmentRows = assignmentRows.filter((a) => a.class_id === params.classId);
  }
  if (params.trackId) {
    assignmentRows = assignmentRows.filter((a) => a.track_id === params.trackId);
  }
  if (params.specializationId) {
    assignmentRows = assignmentRows.filter((a) => a.specialization_id === params.specializationId);
  }

  const allStudentsMap = new Map<string, { id: string; full_name: string }>();
  for (const row of yearStudents ?? []) {
    const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
    if (s?.is_active) allStudentsMap.set(s.id, { id: s.id, full_name: s.full_name });
  }
  const allStudents = [...allStudentsMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );

  const filteredStudentsMap = new Map<string, { id: string; full_name: string }>();
  for (const row of assignmentRows) {
    const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
    if (s?.is_active) filteredStudentsMap.set(s.id, { id: s.id, full_name: s.full_name });
  }

  let students = [...filteredStudentsMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );
  if (mode === "single") {
    students = params.studentId
      ? allStudents.filter((s) => s.id === params.studentId)
      : [];
  }

  type LessonJoin = {
    id: string;
    subject: string;
    class_id: string | null;
    track_id: string | null;
    specialization_id: string | null;
    teacher_teaching_assignments: {
      teacher_id: string;
      teachers: { full_name: string } | null;
    } | null;
  };

  let occurrences = (occurrencesRaw ?? []).map((o) => {
    const lesson = o.lessons as unknown as LessonJoin;
    const teacher = lesson.teacher_teaching_assignments?.teachers;
    return {
      id: o.id,
      date: o.occurrence_date,
      subject: lesson.subject,
      teacherName: teacher?.full_name ?? "",
      teacherId: lesson.teacher_teaching_assignments?.teacher_id ?? "",
      lessonId: lesson.id,
      classId: lesson.class_id,
      trackId: lesson.track_id,
      specializationId: lesson.specialization_id,
    };
  });

  if (params.classId) {
    occurrences = occurrences.filter((o) => o.classId === params.classId);
  }
  if (params.trackId) {
    occurrences = occurrences.filter((o) => o.trackId === params.trackId);
  }
  if (params.specializationId) {
    occurrences = occurrences.filter((o) => o.specializationId === params.specializationId);
  }
  if (params.teacherId) {
    occurrences = occurrences.filter((o) => o.teacherId === params.teacherId);
  }
  if (params.subject) {
    occurrences = occurrences.filter((o) => o.subject === params.subject);
  }

  const subjects = [...new Set(occurrences.map((o) => o.subject))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const occurrenceIds = occurrences.map((o) => o.id);
  let attendanceRecords: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: string;
  }> = [];

  if (occurrenceIds.length > 0) {
    const { data } = await supabase
      .from("attendance")
      .select("student_id, lesson_occurrence_id, status")
      .in("lesson_occurrence_id", occurrenceIds);
    attendanceRecords = data ?? [];
  }

  const lessonIds = [...new Set(occurrences.map((o) => o.lessonId))];
  const pastGaps: Array<{
    lessonId: string;
    subject: string;
    date: string;
    occurrenceId: string;
    gapHandling: "in_treatment" | "continued" | null;
  }> = [];
  let siblingDates: Array<{
    occurrenceId: string;
    lessonId: string;
    date: string;
    subject: string;
  }> = [];
  let noteBody = "";
  let noteLessonId: string | null = null;
  let noteStudentId: string | null = null;

  if (lessonIds.length > 0) {
    const [{ data: pastOccs }, { data: siblings }] = await Promise.all([
      supabase
        .from("lesson_occurrences")
        .select(
          "id, occurrence_date, lesson_id, gap_handling, lessons!inner(subject, academic_year_id)"
        )
        .eq("lessons.academic_year_id", activeYear.id)
        .in("lesson_id", lessonIds)
        .lt("occurrence_date", weekStart)
        .neq("status", "cancelled")
        .order("occurrence_date", { ascending: false })
        .limit(60),
      supabase
        .from("lesson_occurrences")
        .select(
          "id, occurrence_date, lesson_id, lessons!inner(subject, academic_year_id)"
        )
        .eq("lessons.academic_year_id", activeYear.id)
        .in("lesson_id", lessonIds)
        .neq("status", "cancelled")
        .order("occurrence_date", { ascending: false })
        .limit(120),
    ]);

    siblingDates = (siblings ?? []).map((o) => ({
      occurrenceId: o.id,
      lessonId: o.lesson_id,
      date: o.occurrence_date,
      subject: (o.lessons as unknown as { subject: string } | null)?.subject ?? "שיעור",
    }));

    const pastIds = (pastOccs ?? []).map((o) => o.id);
    if (pastIds.length > 0) {
      const { data: pastMarked } = await supabase
        .from("attendance")
        .select("lesson_occurrence_id")
        .in("lesson_occurrence_id", pastIds);
      const marked = new Set((pastMarked ?? []).map((m) => m.lesson_occurrence_id));
      for (const o of pastOccs ?? []) {
        if (marked.has(o.id)) continue;
        pastGaps.push({
          lessonId: o.lesson_id,
          subject: (o.lessons as unknown as { subject: string } | null)?.subject ?? "שיעור",
          date: o.occurrence_date,
          occurrenceId: o.id,
          gapHandling: (o.gap_handling as "in_treatment" | "continued" | null) ?? null,
        });
        if (pastGaps.length >= 12) break;
      }
    }
  }

  if (mode === "single" && params.studentId) {
    const { data: note } = await supabase
      .from("attendance_notes")
      .select("body")
      .eq("academic_year_id", activeYear.id)
      .eq("student_id", params.studentId)
      .maybeSingle();
    noteBody = note?.body ?? "";
    noteStudentId = params.studentId;
  } else {
    const focusLesson =
      (params.occurrenceId
        ? occurrences.find((o) => o.id === params.occurrenceId)?.lessonId
        : undefined) ?? lessonIds[0];
    if (focusLesson) {
      const { data: note } = await supabase
        .from("attendance_notes")
        .select("body")
        .eq("academic_year_id", activeYear.id)
        .eq("lesson_id", focusLesson)
        .maybeSingle();
      noteBody = note?.body ?? "";
      noteLessonId = focusLesson;
    }
  }

  return (
    <div>
      <PageHeader
        title="נוכחות"
        description="תאריך עברי ראשי, סימון מהיר, והתראות על מופעים חסרים במקום. איחור נספר כנוכחות."
      />

      <AttendanceBoard
        yearId={activeYear.id}
        filters={{
          mode,
          view,
          weekStart,
          weekLabel: `${formatHebrewDate(weekStart)} – ${formatHebrewDate(weekEnd)}`,
          classId: params.classId,
          trackId: params.trackId,
          specializationId: params.specializationId,
          teacherId: params.teacherId,
          subject: params.subject,
          studentId: params.studentId,
          occurrenceId: params.occurrenceId,
        }}
        classes={classes ?? []}
        tracks={tracks ?? []}
        specializations={specializations ?? []}
        teachers={(teachers ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
        subjects={subjects}
        students={students}
        allStudents={allStudents}
        occurrences={occurrences.map(({ teacherId: _t, ...rest }) => rest)}
        attendance={attendanceRecords}
        pastGaps={pastGaps}
        siblingDates={siblingDates}
        noteBody={noteBody}
        noteLessonId={noteLessonId}
        noteStudentId={noteStudentId}
      />
    </div>
  );
}
