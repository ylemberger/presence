import { PageHeader } from "@/components/ui/PageHeader";
import { cannotWriteEmail, isViewerEmail } from "@/lib/auth/allowed-emails";
import {
  audienceForLesson,
  audienceMapFromRows,
  studentMatchesLesson,
} from "@/lib/lessons/autoAssign";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { embeddedTeacher } from "@/lib/supabase/embed";
import { createClient, requireAuthenticatedUser } from "@/lib/supabase/server";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { filterFixedGrades } from "@/lib/years/grades";
import { StudentsDirectory } from "./StudentsDirectory";
import { RepairPromotionsButton } from "../settings/RepairPromotionsButton";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchOpenLessonAssignments(
  supabase: SupabaseClient,
  yearLessonIds: string[]
): Promise<{ student_id: string; lesson_id: string }[]> {
  if (yearLessonIds.length === 0) return [];
  const yearSet = new Set(yearLessonIds);
  const pageSize = 1000;
  const rows: { student_id: string; lesson_id: string }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("student_lesson_assignments")
      .select("student_id, lesson_id")
      .is("end_date", null)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("student_lesson_assignments load failed", error.message);
      break;
    }
    const batch = data ?? [];
    for (const row of batch) {
      if (yearSet.has(row.lesson_id)) {
        rows.push({ student_id: row.student_id, lesson_id: row.lesson_id });
      }
    }
    if (batch.length < pageSize) break;
    from += pageSize;
    if (from > 30000) break;
  }
  return rows;
}

type YearAssignment = {
  student_id: string;
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  start_date: string;
  end_date: string | null;
};

/** Prefer open placement; otherwise the latest assignment in that year (archive). */
function pickPlacementForYear(rows: YearAssignment[]): Map<string, YearAssignment> {
  const byStudent = new Map<string, YearAssignment>();
  const sorted = [...rows].sort((a, b) => {
    if (a.end_date === null && b.end_date !== null) return -1;
    if (a.end_date !== null && b.end_date === null) return 1;
    return b.start_date.localeCompare(a.start_date);
  });
  for (const row of sorted) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, row);
  }
  return byStudent;
}

export default async function StudentsPage() {
  const activeYear = await getActiveAcademicYear();
  const allYears = await getAllAcademicYears();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("full_name");

  const assignments: Record<
    string,
    {
      gradeId: string;
      classId: string;
      trackId: string;
      specId: string | null;
      secondarySpecId: string | null;
      className: string;
      gradeName: string;
      trackName: string;
      specializationName: string;
      secondarySpecializationName: string;
      isPsychology: boolean;
    }
  > = {};

  let yearOptions = null;
  const placedStudentIds = new Set<string>();

  if (activeYear) {
    const [
      { data: yearAssignments, error: assignmentsError },
      { data: grades },
      { data: classes },
      { data: tracks },
      { data: specializations },
      { data: yearLessons },
    ] = await Promise.all([
      supabase
        .from("student_assignments")
        .select(
          "student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date, end_date"
        )
        .eq("academic_year_id", activeYear.id),
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("specializations")
        .select("*")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase
        .from("lessons")
        .select(
          "id, subject, day_of_week, lesson_number, period_count, billing_type, for_psychology, grade_id, class_id, track_id, specialization_id, subjects(name), teacher_teaching_assignments(teacher_id, teachers(full_name))"
        )
        .eq("academic_year_id", activeYear.id)
        .order("subject"),
    ]);

    if (assignmentsError) {
      console.error("student_assignments load failed", assignmentsError.message);
    }

    const gradeNameById = new Map((grades ?? []).map((g) => [g.id, g.name]));
    const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
    const trackNameById = new Map((tracks ?? []).map((t) => [t.id, t.name]));
    const specNameById = new Map((specializations ?? []).map((s) => [s.id, s.name]));

    const picked = pickPlacementForYear((yearAssignments ?? []) as YearAssignment[]);
    for (const [studentId, a] of picked) {
      placedStudentIds.add(studentId);
      assignments[studentId] = {
        gradeId: a.grade_id,
        classId: a.class_id,
        trackId: a.track_id,
        specId: a.specialization_id,
        secondarySpecId: a.secondary_specialization_id,
        className: classNameById.get(a.class_id) ?? "לא משובצת",
        gradeName: gradeNameById.get(a.grade_id) ?? "—",
        trackName: trackNameById.get(a.track_id) ?? "—",
        specializationName: a.specialization_id
          ? specNameById.get(a.specialization_id) ?? "—"
          : "—",
        secondarySpecializationName: a.secondary_specialization_id
          ? specNameById.get(a.secondary_specialization_id) ?? "—"
          : "—",
        isPsychology: Boolean(a.is_psychology),
      };
    }

    const yearLessonIds = (yearLessons ?? []).map((lesson) => lesson.id as string);
    const [openLessonAssignments, audienceRes, exclusionRes] = await Promise.all([
      fetchOpenLessonAssignments(supabase, yearLessonIds),
      yearLessonIds.length > 0
        ? supabase
            .from("lesson_audience")
            .select("lesson_id, grade_id, class_id, track_id, specialization_id")
            .in("lesson_id", yearLessonIds)
        : Promise.resolve({ data: [] as { lesson_id: string; grade_id: string | null; class_id: string | null; track_id: string | null; specialization_id: string | null }[] }),
      yearLessonIds.length > 0
        ? supabase
            .from("student_lesson_exclusions")
            .select("student_id, lesson_id")
            .in("lesson_id", yearLessonIds)
        : Promise.resolve({ data: [] as { student_id: string; lesson_id: string }[], error: null }),
    ]);
    const audienceByLesson = audienceMapFromRows(audienceRes.data ?? []);

    const lessons = (yearLessons ?? []).map((lesson) => {
      const embedded = lesson.subjects as { name: string } | { name: string }[] | null;
      const subjectName = Array.isArray(embedded)
        ? embedded[0]?.name ?? null
        : embedded?.name ?? null;
      const teacher = embeddedTeacher(lesson.teacher_teaching_assignments);
      const audience = audienceForLesson(
        {
          id: lesson.id as string,
          grade_id: (lesson.grade_id as string | null) ?? null,
          class_id: (lesson.class_id as string | null) ?? null,
          track_id: (lesson.track_id as string | null) ?? null,
          specialization_id: (lesson.specialization_id as string | null) ?? null,
        },
        audienceByLesson
      );
      const teacherName = teacher?.fullName ?? "";
      return {
        id: lesson.id as string,
        subjectKey: (subjectName || String(lesson.subject ?? "")).trim(),
        label: formatLessonOptionLabel({
          subject: String(lesson.subject ?? ""),
          subjectName,
          day_of_week: lesson.day_of_week as number | null,
          lesson_number: lesson.lesson_number as number | null,
          period_count: (lesson.period_count as number | null) ?? 1,
          billing_type: lesson.billing_type as string | null,
        }),
        teacherId: teacher?.id || null,
        teacherName,
        gradeIds: audience.grade_ids.length
          ? audience.grade_ids
          : lesson.grade_id
            ? [String(lesson.grade_id)]
            : [],
        classIds: audience.class_ids,
        trackIds: audience.track_ids,
        specializationIds: audience.specialization_ids,
      };
    });
    const exclusionError = "error" in exclusionRes ? exclusionRes.error : null;
    const excluded = new Set(
      (exclusionError ? [] : exclusionRes.data ?? []).map(
        (row) => `${row.student_id}::${row.lesson_id}`
      )
    );

    const assignedLessonIdsByStudent: Record<string, string[]> = {};
    function addLesson(studentId: string, lessonId: string) {
      if (excluded.has(`${studentId}::${lessonId}`)) return;
      const list = assignedLessonIdsByStudent[studentId] ?? [];
      if (!list.includes(lessonId)) list.push(lessonId);
      assignedLessonIdsByStudent[studentId] = list;
    }
    for (const row of openLessonAssignments) {
      addLesson(row.student_id, row.lesson_id);
    }
    const lessonScopes = (yearLessons ?? []).map((lesson) => {
      const audience = audienceForLesson(
        {
          id: lesson.id as string,
          grade_id: (lesson.grade_id as string | null) ?? null,
          class_id: (lesson.class_id as string | null) ?? null,
          track_id: (lesson.track_id as string | null) ?? null,
          specialization_id: (lesson.specialization_id as string | null) ?? null,
        },
        audienceByLesson
      );
      return {
        id: lesson.id as string,
        class_id: (lesson.class_id as string | null) ?? null,
        track_id: (lesson.track_id as string | null) ?? null,
        specialization_id: (lesson.specialization_id as string | null) ?? null,
        billing_type: String(lesson.billing_type ?? "mandatory"),
        grade_id: String(lesson.grade_id ?? ""),
        for_psychology: Boolean(lesson.for_psychology),
        audience,
      };
    });
    for (const [studentId, a] of picked) {
      const placement = {
        grade_id: a.grade_id,
        class_id: a.class_id,
        track_id: a.track_id,
        specialization_id: a.specialization_id,
        secondary_specialization_id: a.secondary_specialization_id,
        is_psychology: Boolean(a.is_psychology),
      };
      for (const lesson of lessonScopes) {
        if (studentMatchesLesson(placement, lesson)) addLesson(studentId, lesson.id);
      }
    }

    yearOptions = {
      yearId: activeYear.id,
      grades: filterFixedGrades(grades ?? []),
      classes: classes ?? [],
      tracks: tracks ?? [],
      specializations: specializations ?? [],
      lessons,
      assignedLessonIdsByStudent,
    };
  }

  const rows = (students ?? [])
    .filter((s) => placedStudentIds.has(s.id) || s.is_active)
    .map((s) => ({
      id: s.id,
      full_name: s.full_name,
      first_name: s.first_name ?? "",
      last_name: s.last_name ?? "",
      mi: s.mi ?? null,
      identity_number: s.identity_number,
      cohort_number: s.cohort_number ?? 1,
      city: s.city ?? null,
      phone: s.phone ?? null,
      father_phone: s.father_phone ?? null,
      mother_phone: s.mother_phone ?? null,
      student_phone: s.student_phone ?? null,
      high_school: s.high_school ?? null,
      chetz_program: Boolean(s.chetz_program),
      birth_date: s.birth_date ?? null,
      birth_date_hebrew: s.birth_date_hebrew ?? null,
      address: s.address ?? null,
      personal_note: s.personal_note ?? null,
      is_active: s.is_active,
      gradeId: assignments[s.id]?.gradeId ?? "",
      classId: assignments[s.id]?.classId ?? "",
      trackId: assignments[s.id]?.trackId ?? "",
      specId: assignments[s.id]?.specId ?? null,
      secondarySpecId: assignments[s.id]?.secondarySpecId ?? null,
      className: assignments[s.id]?.className ?? "לא משובצת",
      gradeName: assignments[s.id]?.gradeName ?? "—",
      trackName: assignments[s.id]?.trackName ?? "—",
      specializationName: assignments[s.id]?.specializationName ?? "—",
      secondarySpecializationName: assignments[s.id]?.secondarySpecializationName ?? "—",
      isPsychology: assignments[s.id]?.isPsychology ?? false,
    }));

  const activeUnplaced = rows.filter((s) => s.is_active && !placedStudentIds.has(s.id)).length;
  const yearIdx = allYears.findIndex((y) => y.id === activeYear?.id);
  const previousYear = yearIdx >= 0 ? allYears[yearIdx + 1] : allYears[1];

  const { user } = await requireAuthenticatedUser();
  const listOnly = isViewerEmail(user.email);
  const canWrite = !cannotWriteEmail(user.email);

  return (
    <div>
      <div className="print:hidden">
      <PageHeader
        title="תלמידות"
        description={
          listOnly
            ? "צפייה ברשימת התלמידות. אין פתיחת כרטיס ואין עריכה."
            : canWrite
              ? "כרטסת קבועה עם מחזור. שיבוץ (שכבה/כיתה/מסלול) לפי השנה שנבחרה למעלה. בארכיון רואים את מה שהיה באותה שנה."
              : "צפייה בתלמידות ובכרטיסים. אין הוספה ואין עריכה."
        }
      />
      </div>
      {canWrite && activeUnplaced > 0 && previousYear && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-secondary-container/40 p-4 print:hidden">
          <p className="mb-2 text-body-md font-medium text-on-surface">
            {activeUnplaced} תלמידות פעילות בלי שיבוץ בשנה הנוכחית
          </p>
          <RepairPromotionsButton
            missingCount={activeUnplaced}
            previousYearName={previousYear.name}
          />
        </div>
      )}
      <StudentsDirectory
        students={rows}
        yearOptions={yearOptions}
        viewOnly={listOnly}
        canWrite={canWrite}
        yearName={activeYear?.name ?? ""}
      />
    </div>
  );
}
