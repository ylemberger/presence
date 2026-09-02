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
  };
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
      .eq("academic_year_id", activeYear.id)
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

  // 2) fetch lessons templates
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

  if (lessonIdFilter) {
    if (lessonIdFilter.length === 0) {
      return (
        <div className="flex flex-col gap-stack_lg">
          <PageHeader
            title="מערכת שעות"
            description="סינון לפי תלמידה, לא נמצאו שיעורים פעילים."
            size="headline"
          />
          <div className="print:hidden">
            <TimetableFilters
              classes={(classes ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
              tracks={(tracks ?? []).map((t: any) => ({ id: t.id, name: t.name }))}
              specializations={(specializations ?? []).map((s: any) => ({ id: s.id, name: s.name }))}
              teachers={(teachers ?? []).map((t: any) => ({ id: t.id, name: t.full_name }))}
              students={(students ?? []).map((s: any) => ({ id: s.id, full_name: s.full_name }))}
              subjects={subjects}
              activityRanges={(activityRanges ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
              defaults={{
                classId: params.classId,
                trackId: params.trackId,
                specializationId: params.specializationId,
                teacherId: params.teacherId,
                subject: params.subject,
                studentId: params.studentId,
                activityRangeId: params.activityRangeId,
                forPsychology:
                  params.forPsychology === "yes"
                    ? "yes"
                    : params.forPsychology === "no"
                      ? "no"
                      : "all",
              }}
            />
          </div>
          <Section>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-6 py-10 text-center">
              <Icon name="event_busy" className="text-[36px] text-secondary" />
              <p className="font-body-md text-body-md text-on-surface-variant">
                לא נמצאו שיעורים פעילים לתלמידה שבחרת.
              </p>
            </div>
          </Section>
        </div>
      );
    }

    lessonsQuery = lessonsQuery.in("id", lessonIdFilter);
  }
  if (params.classId) lessonsQuery = lessonsQuery.eq("class_id", params.classId);
  if (params.trackId) lessonsQuery = lessonsQuery.eq("track_id", params.trackId);
  if (params.specializationId) lessonsQuery = lessonsQuery.eq("specialization_id", params.specializationId);
  if (params.teacherId) {
    // We'll filter in-memory after join because teacher_teaching_assignments is a nested relation
  }
  if (params.activityRangeId) lessonsQuery = lessonsQuery.eq("activity_range_id", params.activityRangeId);
  if (forPsychology !== undefined) lessonsQuery = lessonsQuery.eq("for_psychology", forPsychology);

  const { data: lessonsRows } = await lessonsQuery;

  const entries: TimetableEntry[] = (lessonsRows ?? [])
    .filter((l: any) => {
      if (params.teacherId) {
        const teacherId = (l.teacher_teaching_assignments as any)?.teacher_id ?? null;
        if (teacherId !== params.teacherId) return false;
      }
      if (params.subject) {
        const parent = Array.isArray(l.subjects) ? l.subjects[0]?.name : l.subjects?.name;
        if (parent !== params.subject && l.subject !== params.subject) return false;
      }
      return true;
    })
    .map((l: any) => {
      const teacher = (l.teacher_teaching_assignments as any)?.teachers as
        | { full_name: string }
        | null;
      const teacherId = (l.teacher_teaching_assignments as any)?.teacher_id ?? null;
      const parent = Array.isArray(l.subjects) ? l.subjects[0]?.name : l.subjects?.name;

      let audienceLabel = "";
      if (l.billing_type === "specialization") {
        const spec = l.specializations as unknown as { name: string } | null;
        audienceLabel = spec?.name ?? "—";
      } else {
        const cls = l.classes as unknown as { name: string } | null;
        const tr = l.tracks as unknown as { name: string } | null;
        audienceLabel = cls?.name ?? tr?.name ?? "—";
      }

      return {
        lessonId: l.id,
        subject: formatSubjectLessonLabel(parent, l.subject),
        teacherName: teacher?.full_name ?? "",
        teacherId,
        dayOfWeek: l.day_of_week,
        lessonNumber: l.lesson_number,
        periodCount: l.period_count ?? 1,
        billingType: l.billing_type,
        forPsychology: l.for_psychology,
        audienceLabel,
      };
    });

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="מערכת שעות"
        description="סינון לפי כיתה/מסלול/התמחות/מורה/מקצוע/תלמידה, כולל פסיכולוגיה."
        size="headline"
      />

      <div className="print:hidden">
        <TimetableFilters
          classes={(classes ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
          tracks={(tracks ?? []).map((t: any) => ({ id: t.id, name: t.name }))}
          specializations={(specializations ?? []).map((s: any) => ({ id: s.id, name: s.name }))}
          teachers={(teachers ?? []).map((t: any) => ({ id: t.id, name: t.full_name }))}
          students={(students ?? []).map((s: any) => ({ id: s.id, full_name: s.full_name }))}
          subjects={subjects}
          activityRanges={(activityRanges ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
          defaults={{
            classId: params.classId,
            trackId: params.trackId,
            specializationId: params.specializationId,
            teacherId: params.teacherId,
            subject: params.subject,
            studentId: params.studentId,
            activityRangeId: params.activityRangeId,
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
        <Section icon="calendar_view_week" title="מערכת שבועית">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-6 py-10 text-center">
            <Icon name="search_off" className="text-[36px] text-secondary" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              לא נמצאו שיעורים לסינון שבחרת.
            </p>
          </div>
        </Section>
      ) : (
        <Section icon="calendar_view_week" title="מערכת שבועית" bodyBleed>
          <div className="p-4">
            <WeeklyTimetableGrid entries={entries} />
          </div>
        </Section>
      )}
    </div>
  );
}

