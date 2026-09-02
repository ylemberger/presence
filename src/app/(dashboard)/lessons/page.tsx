import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { LessonsCalendar } from "./LessonsCalendar";
import { LessonsForm } from "./LessonsForm";
import { LessonsFilters } from "./LessonsFilters";
import { filterFixedGrades } from "@/lib/years/grades";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  todayIso,
} from "@/lib/dates/hebrew";
import type { Lesson } from "@/types/database";
import { holidayDatesByKind } from "@/lib/lessons/holidays";
import {
  audienceForLesson,
  audienceMapFromRows,
  lessonMatchesAudienceFilter,
} from "@/lib/lessons/autoAssign";
import { describeAudienceScope } from "@/lib/validation";
import { formatLessonHours } from "@/lib/lessons/hours";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import {
  salaryDisplayFields,
  uniqueSalaryAssignments,
} from "@/lib/teachers/salary-display";
import {
  fetchTeacherSourceRecords,
  groupSourceRowsByTeacher,
} from "@/lib/teachers/source-records";
import type { LessonTemplateCard } from "./LessonsCalendar";
import type { LessonFormTeacher } from "./LessonsForm";

interface Props {
  searchParams: {
    from?: string;
    to?: string;
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
  };
}

function one<T>(v: unknown): T | null {
  if (!v) return null;
  return (Array.isArray(v) ? v[0] : v) as T;
}

export default async function LessonsPage({ searchParams }: Props) {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title="יומן שיעורים עברי"
          description="יש להגדיר שנה אקדמית פעילה תחילה."
        />
      </div>
    );
  }

  const monthSeed = hebrewMonthFromIso(searchParams.from || todayIso());
  const month = buildHebrewMonth(monthSeed.year, monthSeed.month);
  const from = searchParams.from || month.rangeStart;
  const to = searchParams.to || month.rangeEnd;

  const [lessonsRes, teachers, sourceRows, grades, classes, tracks, specializations, subjectsRes, ranges, rules, holidays, audienceRes, yearStudentsRes] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          `
          *,
          subjects(name),
          teacher_teaching_assignments(teacher_id, teachers(full_name)),
          classes(name),
          tracks(name),
          specializations(name)
        `
        )
        .eq("academic_year_id", activeYear.id)
        .order("day_of_week"),
      supabase.from("teachers").select("id, full_name, identity_number").order("full_name"),
      fetchTeacherSourceRecords(supabase),
      supabase.from("grades").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("classes")
        .select("id, name, grade_id")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase.from("tracks").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("specializations")
        .select("id, name")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase.from("subjects").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("activity_ranges").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("attendance_rules").select("*"),
      supabase
        .from("holiday_periods")
        .select("start_date, end_date, kind")
        .eq("academic_year_id", activeYear.id),
      supabase.from("lesson_audience").select("lesson_id, grade_id, class_id, track_id, specialization_id"),
      supabase
        .from("student_assignments")
        .select("student_id, students(id, full_name, is_active)")
        .eq("academic_year_id", activeYear.id)
        .is("end_date", null),
    ]);

  type LessonRow = Lesson & {
    subjects?: { name: string } | { name: string }[] | null;
    teacher_teaching_assignments?: unknown;
    classes?: unknown;
    tracks?: unknown;
    specializations?: unknown;
  };

  const allLessons = (lessonsRes.data ?? []) as LessonRow[];
  const audienceByLesson = audienceMapFromRows(audienceRes.data ?? []);
  const filteredLessons = allLessons.filter((l) => {
    if (
      !lessonMatchesAudienceFilter(audienceForLesson(l, audienceByLesson), {
        classId: searchParams.classId,
        trackId: searchParams.trackId,
        specializationId: searchParams.specializationId,
      })
    ) {
      return false;
    }
    if (searchParams.subject) {
      const parentName = one<{ name: string }>(l.subjects)?.name ?? "";
      if (parentName !== searchParams.subject && l.subject !== searchParams.subject) return false;
    }
    if (searchParams.teacherId) {
      const assignment = one<{ teacher_id: string }>(l.teacher_teaching_assignments);
      if (assignment?.teacher_id !== searchParams.teacherId) return false;
    }
    return true;
  });

  const filteredIds = filteredLessons.map((l) => l.id);
  const yearSubjects = subjectsRes.data ?? [];
  const subjects = [...new Set(yearSubjects.map((s) => s.name))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const { data: slaRows } =
    filteredIds.length === 0
      ? { data: [] as { lesson_id: string }[] }
      : await supabase
          .from("student_lesson_assignments")
          .select("lesson_id")
          .in("lesson_id", filteredIds)
          .is("end_date", null);

  const studentCountByLesson = new Map<string, number>();
  for (const row of slaRows ?? []) {
    studentCountByLesson.set(row.lesson_id, (studentCountByLesson.get(row.lesson_id) ?? 0) + 1);
  }

  const gradeById = new Map((grades.data ?? []).map((g) => [g.id, g.name]));
  const classById = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
  const trackById = new Map((tracks.data ?? []).map((t) => [t.id, t.name]));
  const specById = new Map((specializations.data ?? []).map((s) => [s.id, s.name]));
  const rangeById = new Map((ranges.data ?? []).map((r) => [r.id, r.name]));

  const yearStudents = [...new Map(
    (yearStudentsRes.data ?? [])
      .map((row) => {
        const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
        return s?.is_active ? ([s.id, { id: s.id, full_name: s.full_name }] as const) : null;
      })
      .filter((v): v is readonly [string, { id: string; full_name: string }] => Boolean(v))
  ).values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));

  const lessonCards: LessonTemplateCard[] = filteredLessons.map((l) => {
    const assignment = one<{ teacher_id: string; teachers?: unknown }>(l.teacher_teaching_assignments);
    const teacherName = one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "";
    const audience = audienceForLesson(l, audienceByLesson);
    const gradeNames =
      audience.grade_ids.length > 0
        ? audience.grade_ids
            .map((id) => gradeById.get(id))
            .filter((n): n is string => Boolean(n))
        : [gradeById.get(l.grade_id)].filter((n): n is string => Boolean(n));
    const audienceLabel = describeAudienceScope({
      billing_type: l.billing_type,
      gradeNames,
      classNames: audience.class_ids.map((id) => classById.get(id)).filter((n): n is string => Boolean(n)),
      trackNames: audience.track_ids.map((id) => trackById.get(id)).filter((n): n is string => Boolean(n)),
      specializationNames: audience.specialization_ids
        .map((id) => specById.get(id))
        .filter((n): n is string => Boolean(n)),
      forPsychology: l.for_psychology,
      wholeGrade:
        audience.class_ids.length === 0 &&
        audience.track_ids.length === 0 &&
        audience.specialization_ids.length === 0,
    });
    return {
      ...l,
      subject: formatSubjectLessonLabel(one<{ name: string }>(l.subjects)?.name, l.subject),
      teacherName,
      gradeName: gradeNames.join(" / ") || (gradeById.get(l.grade_id) ?? ""),
      audienceLabel,
      rangeName: rangeById.get(l.activity_range_id) ?? "",
      studentCount: studentCountByLesson.get(l.id) ?? 0,
    };
  });

  const occurrenceSelect =
    "id, occurrence_date, status, notes, lesson_id, lessons!inner(subject, academic_year_id, subjects(name))";

  const monthOcc =
    filteredIds.length === 0
      ? { data: [] }
      : await supabase
          .from("lesson_occurrences")
          .select(occurrenceSelect)
          .eq("lessons.academic_year_id", activeYear.id)
          .in("lesson_id", filteredIds)
          .neq("status", "cancelled")
          .gte("occurrence_date", from)
          .lte("occurrence_date", to)
          .order("occurrence_date");

  const lessonById = new Map(filteredLessons.map((l) => [l.id, l]));
  const mapOcc = (
    rows: {
      id: string;
      occurrence_date: string;
      status: string;
      notes: string | null;
      lesson_id: string;
      lessons?: unknown;
    }[]
  ) =>
    rows.map((o) => {
      const lesson = lessonById.get(o.lesson_id);
      const assignment = one<{ teachers?: unknown }>(lesson?.teacher_teaching_assignments);
      return {
        id: o.id,
        occurrence_date: o.occurrence_date,
        status: o.status,
        notes: o.notes,
        lesson_id: o.lesson_id,
        subject: formatSubjectLessonLabel(
          one<{ name: string }>(lesson?.subjects)?.name,
          lesson?.subject ?? ""
        ),
        teacherName: one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "",
        hoursLabel: lesson
          ? formatLessonHours(lesson.lesson_number, lesson.period_count ?? 1)
          : "",
      };
    });

  const occurrenceRows = mapOcc(monthOcc.data ?? []);

  const identityToTeacherId = new Map(
    (teachers.data ?? []).map((t) => [t.identity_number, t.id])
  );
  const sourcesByTeacher = groupSourceRowsByTeacher(sourceRows, identityToTeacherId);

  const teachersForForm: LessonFormTeacher[] = (teachers.data ?? []).map((t) => ({
    id: t.id,
    full_name: t.full_name,
    salaryAssignments: uniqueSalaryAssignments(
      (sourcesByTeacher.get(t.id) ?? []).map((s) => salaryDisplayFields(s))
    ),
  }));

  const formProps = {
    yearId: activeYear.id,
    teachers: teachersForForm,
    grades: filterFixedGrades(grades.data ?? []),
    classes: classes.data ?? [],
    tracks: tracks.data ?? [],
    specializations: specializations.data ?? [],
    subjects: yearSubjects,
    ranges: ranges.data ?? [],
    rules: rules.data ?? [],
  };

  const filterQuery = new URLSearchParams();
  if (searchParams.classId) filterQuery.set("classId", searchParams.classId);
  if (searchParams.trackId) filterQuery.set("trackId", searchParams.trackId);
  if (searchParams.specializationId) {
    filterQuery.set("specializationId", searchParams.specializationId);
  }
  if (searchParams.teacherId) filterQuery.set("teacherId", searchParams.teacherId);
  if (searchParams.subject) filterQuery.set("subject", searchParams.subject);

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="יומן שיעורים עברי"
        description="יצירת שיעור פותחת אוטומטית את המופעים בטווח שנבחר. אין יצירת מופע בודד — ליום אחד מגדירים טווח של יום אחד. ימי חופשה לא נכללים."
      />

      <LessonsFilters
        classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        tracks={(tracks.data ?? []).map((t) => ({ id: t.id, name: t.name }))}
        specializations={(specializations.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        teachers={(teachers.data ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
        subjects={subjects}
        monthFrom={from}
        monthTo={to}
        defaults={{
          classId: searchParams.classId,
          trackId: searchParams.trackId,
          specializationId: searchParams.specializationId,
          teacherId: searchParams.teacherId,
          subject: searchParams.subject,
        }}
      />

      <Section
        icon="edit_note"
        title="יצירת שיעור חדש"
        accent="featured"
        titleClassName="font-headline-md text-headline-md"
      >
        {formProps.teachers.length === 0 && (
          <p className="mb-3 rounded-lg bg-attendance-late/10 px-4 py-3 font-body-lg text-body-lg text-attendance-late">
            אין מורות במערכת.{" "}
            <a href="/teachers" className="font-semibold underline">
              הוסיפי מורה
            </a>{" "}
            לפני יצירת שיעור.
          </p>
        )}
        <LessonsForm {...formProps} />
      </Section>

      <LessonsCalendar
        initialMonthIso={from}
        occurrences={occurrenceRows}
        lessons={lessonCards}
        monthQuery={filterQuery.toString()}
        holidayDates={holidayDatesByKind(holidays.data ?? []).vacation}
        cancelledDates={holidayDatesByKind(holidays.data ?? []).cancelled}
        students={yearStudents}
      />
    </div>
  );
}
