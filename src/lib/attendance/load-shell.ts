import { getYearCatalog } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { embedOne, embeddedTeacher } from "@/lib/supabase/embed";
import { fetchAllPages } from "@/lib/supabase/paged";
import {
  audienceForLesson,
  audienceMapFromRows,
  type AudienceRow,
  type LessonAudienceIds,
} from "@/lib/lessons/autoAssign";
import { formatLessonGroupLabel } from "@/lib/lessons/group-label";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import {
  buildPoolCatalog,
  fetchAttendancePools,
  type PoolCatalog,
} from "@/lib/attendance/pools";
import { compareStudentsByLastName } from "@/lib/students/sort";
import { readShellCache, writeShellCache } from "@/lib/attendance/shell-cache";

export type ShellStudent = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  is_active?: boolean;
};

export type ShellLesson = {
  id: string;
  subject: string;
  subjectRaw: string;
  subjectKey: string;
  subjectId: string | null;
  teacherId: string;
  teacherName: string;
  classId: string | null;
  trackId: string | null;
  specializationId: string | null;
  gradeId: string | null;
  groupLabel: string;
  day_of_week: number | null;
  lesson_number: number | null;
  period_count: number | null;
  billing_type: string | null;
  for_psychology: boolean;
  attendance_rule_id: string | null;
};

export type AttendanceShell = {
  yearId: string;
  catalog: Awaited<ReturnType<typeof getYearCatalog>>;
  lessons: ShellLesson[];
  subjects: string[];
  allStudents: ShellStudent[];
  audienceByLesson: Map<string, LessonAudienceIds>;
  poolCatalog: PoolCatalog;
  holidayRows: Array<{ start_date: string; end_date: string; kind?: string | null }>;
  activityRanges: Array<{ start_date: string; end_date: string }>;
};

type CachedShell = {
  catalog: AttendanceShell["catalog"];
  lessons: ShellLesson[];
  subjects: string[];
  allStudents: ShellStudent[];
  audienceRows: AudienceRow[];
  pools: PoolCatalog["pools"];
  members: PoolCatalog["members"];
  holidayRows: AttendanceShell["holidayRows"];
  activityRanges: AttendanceShell["activityRanges"];
};

function inflate(yearId: string, cached: CachedShell): AttendanceShell {
  return {
    yearId,
    catalog: cached.catalog,
    lessons: cached.lessons,
    subjects: cached.subjects,
    allStudents: cached.allStudents,
    audienceByLesson: audienceMapFromRows(cached.audienceRows),
    poolCatalog: buildPoolCatalog(cached.pools, cached.members),
    holidayRows: cached.holidayRows,
    activityRanges: cached.activityRanges,
  };
}

export async function loadAttendanceShell(yearId: string): Promise<AttendanceShell> {
  const key = `attendance-shell:${yearId}`;
  const cached = readShellCache<CachedShell>(key);
  if (cached) return inflate(yearId, cached);

  const supabase = await createClient();
  const catalog = await getYearCatalog(yearId);

  const [audienceRows, lessonRows, studentRows, holidayRows, activityRangeRows, poolCatalog] =
    await Promise.all([
      fetchAllPages<AudienceRow>((from, to) =>
        supabase
          .from("lesson_audience")
          .select("lesson_id, grade_id, class_id, track_id, specialization_id")
          .range(from, to)
      ),
      fetchAllPages<{
        id: string;
        subject: string;
        subject_id: string | null;
        day_of_week: number | null;
        lesson_number: number | null;
        period_count: number | null;
        billing_type: string | null;
        for_psychology: boolean | null;
        grade_id: string | null;
        class_id: string | null;
        track_id: string | null;
        specialization_id: string | null;
        attendance_rule_id: string | null;
        subjects: { name: string } | { name: string }[] | null;
        teacher_teaching_assignments: unknown;
      }>((from, to) =>
        supabase
          .from("lessons")
          .select(
            `id, subject, subject_id, day_of_week, lesson_number, period_count, billing_type, for_psychology,
             grade_id, class_id, track_id, specialization_id, attendance_rule_id, subjects(name),
             teacher_teaching_assignments(teacher_id, teachers(full_name))`
          )
          .eq("academic_year_id", yearId)
          .order("subject")
          .range(from, to)
      ),
      fetchAllPages<{
        student_id: string;
        class_id: string | null;
        track_id: string | null;
        specialization_id: string | null;
        students: unknown;
      }>((from, to) =>
        supabase
          .from("student_assignments")
          .select(
            "student_id, class_id, track_id, specialization_id, students(id, full_name, first_name, last_name, is_active)"
          )
          .eq("academic_year_id", yearId)
          .is("end_date", null)
          .range(from, to)
      ),
      fetchAllPages<{ start_date: string; end_date: string; kind?: string | null }>((from, to) =>
        supabase.from("holiday_periods").select("start_date, end_date, kind").range(from, to)
      ),
      fetchAllPages<{ start_date: string; end_date: string }>((from, to) =>
        supabase.from("activity_ranges").select("start_date, end_date").range(from, to)
      ),
      fetchAttendancePools(supabase, yearId),
    ]);

  const audienceByLesson = audienceMapFromRows(audienceRows);
  const gradeNameById = new Map((catalog.grades ?? []).map((g) => [g.id, g.name]));
  const classNameById = new Map(catalog.classes.map((c) => [c.id, c.name]));
  const trackNameById = new Map(catalog.tracks.map((t) => [t.id, t.name]));
  const specNameById = new Map(catalog.specializations.map((s) => [s.id, s.name]));

  const lessons: ShellLesson[] = lessonRows.map((l) => {
    const embedded = embedOne<{ name: string }>(l.subjects);
    const name = embedded?.name;
    const teacher = embeddedTeacher(l.teacher_teaching_assignments);
    const audience = audienceForLesson(
      {
        id: l.id,
        grade_id: l.grade_id,
        class_id: l.class_id,
        track_id: l.track_id,
        specialization_id: l.specialization_id,
      },
      audienceByLesson
    );
    return {
      id: l.id,
      subject: formatSubjectLessonLabel(name, l.subject),
      subjectRaw: l.subject,
      subjectKey: name?.trim() || l.subject,
      subjectId: l.subject_id,
      teacherId: teacher?.id ?? "",
      teacherName: teacher?.fullName ?? "",
      classId: l.class_id,
      trackId: l.track_id,
      specializationId: l.specialization_id,
      gradeId: l.grade_id,
      groupLabel: formatLessonGroupLabel({
        billingType: l.billing_type,
        forPsychology: Boolean(l.for_psychology),
        gradeNames: audience.grade_ids.map((id) => gradeNameById.get(id) ?? "").filter(Boolean),
        classNames: audience.class_ids.map((id) => classNameById.get(id) ?? "").filter(Boolean),
        trackNames: audience.track_ids.map((id) => trackNameById.get(id) ?? "").filter(Boolean),
        specializationNames: audience.specialization_ids
          .map((id) => specNameById.get(id) ?? "")
          .filter(Boolean),
      }),
      day_of_week: l.day_of_week,
      lesson_number: l.lesson_number,
      period_count: l.period_count,
      billing_type: l.billing_type,
      for_psychology: Boolean(l.for_psychology),
      attendance_rule_id: l.attendance_rule_id,
    };
  });

  const subjects = [...new Set(lessons.map((l) => l.subjectKey).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const allStudentsMap = new Map<string, ShellStudent>();
  for (const row of studentRows) {
    const s = embedOne<ShellStudent>(row.students);
    if (s?.is_active) allStudentsMap.set(s.id, s);
  }
  const allStudents = [...allStudentsMap.values()].sort(compareStudentsByLastName);

  const packed: CachedShell = {
    catalog,
    lessons,
    subjects,
    allStudents,
    audienceRows,
    pools: poolCatalog.pools,
    members: poolCatalog.members,
    holidayRows,
    activityRanges: activityRangeRows,
  };
  writeShellCache(key, packed);
  return inflate(yearId, packed);
}
