import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import {
  WeeklyTimetableGrid,
  type TimetableEntry,
} from "@/components/timetable/WeeklyTimetableGrid";
import { TimetableFilters } from "./TimetableFilters";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import { Section } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";
import { embeddedTeacher, embedOne } from "@/lib/supabase/embed";
import { compareByFamilyName } from "@/lib/students/sort";
import {
  audienceForLesson,
  audienceMapFromRows,
} from "@/lib/lessons/autoAssign";
import {
  addDays,
  expandIsoRange,
  formatGregorianDate,
  formatHebrewDate,
  parseIsoDate,
  startOfWeekSunday,
  todayIso,
} from "@/lib/dates/hebrew";
import Link from "next/link";

function parseIdList(raw: string | string[] | undefined): string[] {
  const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [...new Set(joined.split(",").map((id) => id.trim()).filter(Boolean))];
}

function overlaps(selected: string[], lessonValues: string[]): boolean {
  if (selected.length === 0) return true;
  if (lessonValues.length === 0) return true;
  return lessonValues.some((id) => selected.includes(id));
}

interface Props {
  searchParams: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    activityRangeId?: string;
    forPsychology?: "yes" | "no" | string;
    week?: string;
  };
}

function parseWeekStart(raw: string | undefined): string {
  const iso = (raw ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return startOfWeekSunday(iso);
  return startOfWeekSunday(todayIso());
}

function timetableHref(
  params: Props["searchParams"],
  classIds: string[],
  trackIds: string[],
  specializationIds: string[],
  week: string
): string {
  const q = new URLSearchParams();
  if (classIds.length) q.set("classId", classIds.join(","));
  if (trackIds.length) q.set("trackId", trackIds.join(","));
  if (specializationIds.length) q.set("specializationId", specializationIds.join(","));
  for (const key of [
    "teacherId",
    "subject",
    "studentId",
    "activityRangeId",
    "forPsychology",
  ] as const) {
    const value = params[key];
    if (value) q.set(key, value);
  }
  q.set("week", week);
  return `/timetable?${q.toString()}`;
}

function WeekNav({
  params,
  classIds,
  trackIds,
  specializationIds,
  weekStart,
  weekEnd,
  isCurrentWeek,
}: {
  params: Props["searchParams"];
  classIds: string[];
  trackIds: string[];
  specializationIds: string[];
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
}) {
  const currentWeek = startOfWeekSunday(todayIso());
  const linkClass =
    "inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container-low";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 px-4 py-3 print:hidden">
      <Link
        href={timetableHref(params, classIds, trackIds, specializationIds, addDays(weekStart, -7))}
        className={linkClass}
      >
        <Icon name="chevron_right" className="text-[18px]" />
        שבוע קודם
      </Link>
      <p className="text-center font-body-md text-body-md text-on-surface">
        <span className="block font-label-md text-primary">
          {isCurrentWeek ? "השבוע הנוכחי" : "שבוע נבחר"}
        </span>
        <span>
          {formatHebrewDate(weekStart)} – {formatHebrewDate(weekEnd)}
        </span>
        <span className="mt-0.5 block font-caption text-caption text-on-surface-variant">
          {formatGregorianDate(weekStart)} – {formatGregorianDate(weekEnd)}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!isCurrentWeek ? (
          <Link href={timetableHref(params, classIds, trackIds, specializationIds, currentWeek)} className={linkClass}>
            לשבוע הנוכחי
          </Link>
        ) : null}
        <Link
          href={timetableHref(params, classIds, trackIds, specializationIds, addDays(weekStart, 7))}
          className={linkClass}
        >
          שבוע הבא
          <Icon name="chevron_left" className="text-[18px]" />
        </Link>
      </div>
    </div>
  );
}

export default async function TimetablePage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title="מערכת שעות"
          description="יש להגדיר שנה אקדמית פעילה."
          size="headline"
        />
      </div>
    );
  }

  const classIds = parseIdList(params.classId);
  const trackIds = parseIdList(params.trackId);
  const specializationIds = parseIdList(params.specializationId);
  const weekStart = parseWeekStart(params.week);
  const weekEnd = addDays(weekStart, 6);
  const weekDates = expandIsoRange(weekStart, weekEnd);
  const currentWeekStart = startOfWeekSunday(todayIso());
  const isCurrentWeek = weekStart === currentWeekStart;

  const forPsychology =
    params.forPsychology === "yes"
      ? true
      : params.forPsychology === "no"
        ? false
        : undefined;

  const [
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: students },
    { data: activityRanges },
    { data: subjectsRows },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase
      .from("tracks")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase
      .from("specializations")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    supabase
      .from("students")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("activity_ranges")
      .select("id, name")
      .order("start_date"),
    supabase.from("subjects").select("name").eq("academic_year_id", activeYear.id).order("name"),
  ]);

  const subjects = [...new Set((subjectsRows ?? []).map((r) => r.name))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  // 1) determine lesson candidates (optionally student-specific)
  let lessonIdFilter: string[] | null = null;
  if (params.studentId) {
    const { data: lessonIds } = await supabase
      .from("student_lesson_assignments")
      .select("lesson_id")
      .eq("student_id", params.studentId)
      .is("end_date", null);
    lessonIdFilter = (lessonIds ?? []).map((r: any) => r.lesson_id);
  }

  let weekOccQuery = supabase
    .from("lesson_occurrences")
    .select("lesson_id, occurrence_date, lessons!inner(academic_year_id)")
    .eq("lessons.academic_year_id", activeYear.id)
    .gte("occurrence_date", weekStart)
    .lte("occurrence_date", weekEnd)
    .neq("status", "cancelled");
  if (lessonIdFilter && lessonIdFilter.length > 0) {
    weekOccQuery = weekOccQuery.in("lesson_id", lessonIdFilter);
  }
  const { data: weekOccurrences } =
    lessonIdFilter && lessonIdFilter.length === 0
      ? { data: [] as { lesson_id: string; occurrence_date: string }[] }
      : await weekOccQuery;

  const datesByLesson = new Map<string, string[]>();
  for (const row of weekOccurrences ?? []) {
    const list = datesByLesson.get(row.lesson_id) ?? [];
    list.push(row.occurrence_date);
    datesByLesson.set(row.lesson_id, list);
  }
  const weekLessonIds = [...datesByLesson.keys()];

  // 2) fetch lesson details for this week's occurrences
  let lessonsQuery = supabase
    .from("lessons")
    .select(
      `
        id, subject, day_of_week, lesson_number, period_count, billing_type, for_psychology,
        class_id, track_id, specialization_id,
        subjects(name),
        teacher_teaching_assignments(teacher_id, teachers(full_name)),
        classes(name),
        tracks(name),
        specializations(name),
        activity_ranges(id, name)
      `
    )
    .eq("academic_year_id", activeYear.id);

  if (weekLessonIds.length > 0) {
    lessonsQuery = lessonsQuery.in("id", weekLessonIds);
  }
  if (params.activityRangeId) lessonsQuery = lessonsQuery.eq("activity_range_id", params.activityRangeId);
  if (forPsychology !== undefined) lessonsQuery = lessonsQuery.eq("for_psychology", forPsychology);

  const { data: lessonsRows } =
    weekLessonIds.length === 0
      ? { data: [] as { id: string }[] }
      : await lessonsQuery;

  const lessonIdsForSlots = (lessonsRows ?? []).map((l: { id: string }) => l.id);
  const { data: audienceRows } =
    lessonIdsForSlots.length > 0
      ? await supabase
          .from("lesson_audience")
          .select("lesson_id, grade_id, class_id, track_id, specialization_id")
          .in("lesson_id", lessonIdsForSlots)
      : { data: [] as { lesson_id: string; grade_id: string | null; class_id: string | null; track_id: string | null; specialization_id: string | null }[] };
  const audienceByLesson = audienceMapFromRows(audienceRows ?? []);
  const { data: slotRows } =
    lessonIdsForSlots.length > 0
      ? await supabase
          .from("lesson_weekly_slots")
          .select("lesson_id, day_of_week, lesson_number, period_count")
          .in("lesson_id", lessonIdsForSlots)
      : { data: [] as { lesson_id: string; day_of_week: number; lesson_number: number; period_count: number }[] };

  const slotsByLesson = new Map<
    string,
    { day_of_week: number; lesson_number: number; period_count: number }[]
  >();
  for (const row of slotRows ?? []) {
    const list = slotsByLesson.get(row.lesson_id) ?? [];
    list.push(row);
    slotsByLesson.set(row.lesson_id, list);
  }

  const entries: TimetableEntry[] = (lessonsRows ?? [])
    .filter((l: any) => {
      const audience = audienceForLesson(l, audienceByLesson);
      if (!overlaps(classIds, audience.class_ids)) return false;
      if (!overlaps(trackIds, audience.track_ids)) return false;
      if (!overlaps(specializationIds, audience.specialization_ids)) return false;
      if (params.teacherId) {
        const teacherId = embeddedTeacher(l.teacher_teaching_assignments)?.id ?? null;
        if (teacherId !== params.teacherId) return false;
      }
      if (params.subject) {
        const parent = embedOne<{ name: string }>(l.subjects)?.name;
        if (parent !== params.subject && l.subject !== params.subject) return false;
      }
      return true;
    })
    .flatMap((l: any) => {
      const teacher = embeddedTeacher(l.teacher_teaching_assignments);
      const teacherId = teacher?.id ?? null;
      const parent = embedOne<{ name: string }>(l.subjects)?.name;

      let audienceLabel = "";
      if (l.billing_type === "specialization") {
        const spec = l.specializations as unknown as { name: string } | null;
        audienceLabel = spec?.name ?? "—";
      } else {
        const cls = l.classes as unknown as { name: string } | null;
        const tr = l.tracks as unknown as { name: string } | null;
        audienceLabel = cls?.name ?? tr?.name ?? "—";
      }

      const dates = datesByLesson.get(l.id) ?? [];
      const slots = slotsByLesson.get(l.id) ?? [];

      return dates.map((date) => {
        const dayOfWeek = parseIsoDate(date).getDay();
        const slot =
          slots.find((s) => s.day_of_week === dayOfWeek) ??
          (l.day_of_week === dayOfWeek
            ? {
                day_of_week: l.day_of_week,
                lesson_number: l.lesson_number,
                period_count: l.period_count ?? 1,
              }
            : {
                day_of_week: dayOfWeek,
                lesson_number: l.lesson_number,
                period_count: l.period_count ?? 1,
              });

        return {
          lessonId: l.id,
          subject: formatSubjectLessonLabel(parent, l.subject),
          teacherName: teacher?.fullName ?? "",
          teacherId,
          dayOfWeek: slot.day_of_week,
          lessonNumber: slot.lesson_number,
          periodCount: slot.period_count ?? 1,
          billingType: l.billing_type,
          forPsychology: l.for_psychology,
          audienceLabel,
        };
      });
    });

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="מערכת שעות"
        description="מוצגים רק מופעים שיש בשבוע הנבחר (ברירת מחדל: השבוע הנוכחי). שיעורים שבוטלו או שאינם חלים השבוע לא מופיעים."
        size="headline"
      />

      <WeekNav
        params={params}
        classIds={classIds}
        trackIds={trackIds}
        specializationIds={specializationIds}
        weekStart={weekStart}
        weekEnd={weekEnd}
        isCurrentWeek={isCurrentWeek}
      />

      <div className="print:hidden">
        <TimetableFilters
          classes={(classes ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
          tracks={(tracks ?? []).map((t: any) => ({ id: t.id, name: t.name }))}
          specializations={(specializations ?? []).map((s: any) => ({ id: s.id, name: s.name }))}
          teachers={[...(teachers ?? [])]
            .sort(compareByFamilyName)
            .map((t: { id: string; full_name: string }) => ({ id: t.id, name: t.full_name }))}
          students={[...(students ?? [])]
            .sort(compareByFamilyName)
            .map((s: { id: string; full_name: string }) => ({ id: s.id, full_name: s.full_name }))}
          subjects={subjects}
          activityRanges={(activityRanges ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
          defaults={{
            classIds,
            trackIds,
            specializationIds,
            teacherId: params.teacherId,
            subject: params.subject,
            studentId: params.studentId,
            activityRangeId: params.activityRangeId,
            week: weekStart,
            forPsychology:
              params.forPsychology === "yes"
                ? "yes"
                : params.forPsychology === "no"
                  ? "no"
                  : "all",
          }}
        />
      </div>

      {entries.length === 0 ? (
        <Section icon="calendar_view_week" title="מערכת השבוע">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-6 py-10 text-center">
            <Icon name="event_busy" className="text-[36px] text-secondary" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              אין מופעים בשבוע זה לפי הסינון שנבחר.
            </p>
          </div>
        </Section>
      ) : (
        <Section icon="calendar_view_week" title="מערכת השבוע" bodyBleed>
          <div className="p-4">
            <WeeklyTimetableGrid entries={entries} columnDates={weekDates} />
          </div>
        </Section>
      )}
    </div>
  );
}

