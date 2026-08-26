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
  formatHebrewDate,
  hebrewMonthFromIso,
  todayIso,
} from "@/lib/dates/hebrew";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import type { Lesson } from "@/types/database";
import { holidayDatesByKind } from "@/lib/lessons/holidays";
import {
  audienceForLesson,
  audienceMapFromRows,
  lessonMatchesAudienceFilter,
} from "@/lib/lessons/autoAssign";
import { describeAudienceScope } from "@/lib/validation";
import { formatLessonHours } from "@/lib/lessons/hours";
import type { LessonTemplateCard } from "./LessonsCalendar";

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
  const today = todayIso();

  const [lessonsRes, teachers, grades, classes, tracks, specializations, ranges, rules, holidays, audienceRes, yearStudentsRes] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          `
          *,
          teacher_teaching_assignments(teacher_id, teachers(full_name)),
          classes(name),
          tracks(name),
          specializations(name)
        `
        )
        .eq("academic_year_id", activeYear.id)
        .order("day_of_week"),
      supabase.from("teachers").select("id, full_name").order("full_name"),
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
    if (searchParams.subject && l.subject !== searchParams.subject) return false;
    if (searchParams.teacherId) {
      const assignment = one<{ teacher_id: string }>(l.teacher_teaching_assignments);
      if (assignment?.teacher_id !== searchParams.teacherId) return false;
    }
    return true;
  });

  const filteredIds = filteredLessons.map((l) => l.id);
  const subjects = [...new Set(allLessons.map((l) => l.subject))].sort((a, b) =>
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
      teacherName,
      gradeName: gradeNames.join(" / ") || (gradeById.get(l.grade_id) ?? ""),
      audienceLabel,
      rangeName: rangeById.get(l.activity_range_id) ?? "",
      studentCount: studentCountByLesson.get(l.id) ?? 0,
    };
  });

  const occurrenceSelect =
    "id, occurrence_date, status, notes, lesson_id, lessons!inner(subject, academic_year_id)";

  const [monthOcc, todayOcc] =
    filteredIds.length === 0
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
          supabase
            .from("lesson_occurrences")
            .select(occurrenceSelect)
            .eq("lessons.academic_year_id", activeYear.id)
            .in("lesson_id", filteredIds)
            .neq("status", "cancelled")
            .gte("occurrence_date", from)
            .lte("occurrence_date", to)
            .order("occurrence_date"),
          supabase
            .from("lesson_occurrences")
            .select(occurrenceSelect)
            .eq("lessons.academic_year_id", activeYear.id)
            .in("lesson_id", filteredIds)
            .neq("status", "cancelled")
            .eq("occurrence_date", today)
            .order("occurrence_date"),
        ]);

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
        subject: one<{ subject: string }>(o.lessons)?.subject ?? lesson?.subject ?? "",
        teacherName: one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "",
        hoursLabel: lesson
          ? formatLessonHours(lesson.lesson_number, lesson.period_count ?? 1)
          : "",
      };
    });

  const occurrenceRows = mapOcc(monthOcc.data ?? []);
  const todayRows = mapOcc(todayOcc.data ?? []);

  const todayItems = todayRows
    .map((o) => {
      const lesson = lessonById.get(o.lesson_id);
      const assignment = one<{
        teacher_id: string;
        teachers?: unknown;
      }>(lesson?.teacher_teaching_assignments);
      const teacherName = one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "";
      const cls = one<{ name: string }>(lesson?.classes)?.name;
      const track = one<{ name: string }>(lesson?.tracks)?.name;
      const spec = one<{ name: string }>(lesson?.specializations)?.name;
      const audience = spec ?? cls ?? track ?? "";
      return {
        ...o,
        lessonNumber: lesson?.lesson_number ?? 0,
        teacherName,
        audience,
      };
    })
    .sort((a, b) => a.lessonNumber - b.lessonNumber);

  const formProps = {
    yearId: activeYear.id,
    teachers: teachers.data ?? [],
    grades: filterFixedGrades(grades.data ?? []),
    classes: classes.data ?? [],
    tracks: tracks.data ?? [],
    specializations: specializations.data ?? [],
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

  const weekday = DAY_OF_WEEK_LABELS[new Date(`${today}T12:00:00`).getDay()] ?? "";

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

      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-12">
        <div className="flex flex-col gap-gutter xl:col-span-4">
          <Section
            icon="today"
            title="שיעורי היום"
            subtitle={`${formatHebrewDate(today)}${weekday ? ` · יום ${weekday}` : ""}`}
          >
            {todayItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                <Icon name="event_available" className="text-[32px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  אין שיעורים היום{filterQuery.toString() ? " לפי הסינון" : ""}.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {todayItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-title-lg text-title-lg text-on-surface">
                        {item.subject}
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant">
                        שיעור {item.lessonNumber}
                      </span>
                    </div>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                      {[item.teacherName, item.audience].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section icon="edit_note" title="יצירת שיעור חדש" accent="featured">
            {formProps.teachers.length === 0 && (
              <p className="mb-3 rounded-lg bg-attendance-late/10 px-3 py-2 font-body-sm text-body-sm text-attendance-late">
                אין מורות במערכת.{" "}
                <a href="/teachers" className="font-semibold underline">
                  הוסיפי מורה
                </a>{" "}
                לפני יצירת שיעור.
              </p>
            )}
            <LessonsForm {...formProps} />
          </Section>
        </div>

        <div className="xl:col-span-8">
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
      </div>
    </div>
  );
}
