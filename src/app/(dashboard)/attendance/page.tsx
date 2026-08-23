import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  todayIso,
} from "@/lib/dates/hebrew";
import { AttendanceBoard, type AttendanceMode } from "./AttendanceBoard";

interface Props {
  searchParams: {
    date?: string;
    from?: string;
    to?: string;
    occurrenceId?: string;
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    mode?: string;
  };
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
  const selectedDate = params.date || todayIso();
  const monthSeed = hebrewMonthFromIso(params.from || selectedDate);
  const month = buildHebrewMonth(monthSeed.year, monthSeed.month);
  const monthFrom = params.from || month.rangeStart;
  const monthTo = params.to || month.rangeEnd;

  const [
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: yearStudents },
    { data: monthOccurrencesRaw },
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
      .gte("occurrence_date", monthFrom)
      .lte("occurrence_date", monthTo)
      .neq("status", "cancelled")
      .order("occurrence_date"),
  ]);

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

  function mapOccurrence(o: NonNullable<typeof monthOccurrencesRaw>[number]) {
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
  }

  let monthOccurrences = (monthOccurrencesRaw ?? []).map(mapOccurrence);

  if (params.classId) monthOccurrences = monthOccurrences.filter((o) => o.classId === params.classId);
  if (params.trackId) monthOccurrences = monthOccurrences.filter((o) => o.trackId === params.trackId);
  if (params.specializationId) {
    monthOccurrences = monthOccurrences.filter((o) => o.specializationId === params.specializationId);
  }
  if (params.teacherId) monthOccurrences = monthOccurrences.filter((o) => o.teacherId === params.teacherId);
  if (params.subject) monthOccurrences = monthOccurrences.filter((o) => o.subject === params.subject);

  const dayOccurrences = monthOccurrences.filter((o) => o.date === selectedDate);

  const allStudentsMap = new Map<string, { id: string; full_name: string }>();
  for (const row of yearStudents ?? []) {
    const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
    if (s?.is_active) allStudentsMap.set(s.id, { id: s.id, full_name: s.full_name });
  }
  const allStudents = [...allStudentsMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );

  const selectedOcc =
    params.occurrenceId && dayOccurrences.find((o) => o.id === params.occurrenceId)
      ? dayOccurrences.find((o) => o.id === params.occurrenceId)!
      : dayOccurrences.length === 1
        ? dayOccurrences[0]
        : null;

  let lessonStudents: { id: string; full_name: string }[] = [];

  if (selectedOcc) {
    const { data: links } = await supabase
      .from("student_lesson_assignments")
      .select("student_id, students(id, full_name, is_active)")
      .eq("lesson_id", selectedOcc.lessonId)
      .lte("start_date", selectedOcc.date)
      .or(`end_date.is.null,end_date.gte.${selectedOcc.date}`);

    const map = new Map<string, { id: string; full_name: string }>();
    for (const link of links ?? []) {
      const s = link.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
      if (s?.is_active) map.set(s.id, { id: s.id, full_name: s.full_name });
    }
    lessonStudents = [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));

    if (mode === "single" && params.studentId) {
      lessonStudents = lessonStudents.filter((s) => s.id === params.studentId);
    }
  }

  const dayOccIds = dayOccurrences.map((o) => o.id);
  const checkOccIds = selectedOcc ? [selectedOcc.id] : dayOccIds;

  let attendanceRecords: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: string;
  }> = [];

  if (checkOccIds.length > 0) {
    const { data } = await supabase
      .from("attendance")
      .select("student_id, lesson_occurrence_id, status")
      .in("lesson_occurrence_id", checkOccIds);
    attendanceRecords = data ?? [];
  }

  // stats per occurrence for day list
  const studentCounts = new Map<string, number>();
  if (dayOccIds.length > 0) {
    const lessonIds = [...new Set(dayOccurrences.map((o) => o.lessonId))];
    const { data: allLinks } = await supabase
      .from("student_lesson_assignments")
      .select("lesson_id, student_id, start_date, end_date, students(is_active)")
      .in("lesson_id", lessonIds);

    for (const occ of dayOccurrences) {
      let count = 0;
      for (const link of allLinks ?? []) {
        if (link.lesson_id !== occ.lessonId) continue;
        const active = (link.students as unknown as { is_active: boolean } | null)?.is_active;
        if (!active) continue;
        if (link.start_date > occ.date) continue;
        if (link.end_date && link.end_date < occ.date) continue;
        count++;
      }
      studentCounts.set(occ.id, count);
    }
  }

  const markedCounts = new Map<string, number>();
  for (const occId of dayOccIds) {
    markedCounts.set(
      occId,
      attendanceRecords.filter((a) => a.lesson_occurrence_id === occId).length
    );
  }

  let noteBody = "";
  if (selectedOcc) {
    const { data: note } = await supabase
      .from("attendance_notes")
      .select("body")
      .eq("academic_year_id", activeYear.id)
      .eq("lesson_id", selectedOcc.lessonId)
      .maybeSingle();
    noteBody = note?.body ?? "";
  } else if (mode === "single" && params.studentId) {
    const { data: note } = await supabase
      .from("attendance_notes")
      .select("body")
      .eq("academic_year_id", activeYear.id)
      .eq("student_id", params.studentId)
      .maybeSingle();
    noteBody = note?.body ?? "";
  }

  const subjects = [...new Set(monthOccurrences.map((o) => o.subject))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  return (
    <div>
      <PageHeader
        title="נוכחות"
        description="בחרי תאריך בלוח העברי → בחרי שיעור → סמני נוכחות. שמירה מיידית בכל לחיצה."
      />

      <AttendanceBoard
        yearId={activeYear.id}
        monthFrom={monthFrom}
        monthTo={monthTo}
        selectedDate={selectedDate}
        selectedOccurrenceId={selectedOcc?.id ?? params.occurrenceId}
        mode={mode}
        classId={params.classId}
        trackId={params.trackId}
        specializationId={params.specializationId}
        teacherId={params.teacherId}
        subject={params.subject}
        studentId={params.studentId}
        classes={classes ?? []}
        tracks={tracks ?? []}
        specializations={specializations ?? []}
        teachers={(teachers ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
        subjects={subjects}
        allStudents={allStudents}
        monthOccurrences={monthOccurrences}
        dayOccurrences={dayOccurrences.map((o) => ({
          ...o,
          studentCount: studentCounts.get(o.id) ?? 0,
          markedCount: markedCounts.get(o.id) ?? 0,
        }))}
        lessonStudents={lessonStudents}
        attendance={attendanceRecords}
        noteBody={noteBody}
        noteLessonId={selectedOcc?.lessonId ?? null}
      />
    </div>
  );
}
