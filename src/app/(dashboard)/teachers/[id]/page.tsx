import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { WeeklyTimetableGrid, type TimetableEntry } from "@/components/timetable/WeeklyTimetableGrid";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { hebrewWeekdayLabels } from "@/lib/dates/hebrew";
import { Icon } from "@/components/ui/Icon";

interface Props {
  params: { id: string };
}

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = params;
  const supabase = await createClient();
  const activeYear = await getActiveAcademicYear();
  const days = hebrewWeekdayLabels();

  const { data: teacher } = await supabase.from("teachers").select("*").eq("id", id).single();
  if (!teacher) notFound();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title={teacher.full_name}
          description="יש להגדיר שנה אקדמית פעילה כדי לראות מערכת שעות."
          size="headline"
        />
      </div>
    );
  }

  const { data: taIdsRaw } = await supabase
    .from("teacher_teaching_assignments")
    .select("id")
    .eq("teacher_id", id)
    .eq("academic_year_id", activeYear.id);
  const taIds = (taIdsRaw ?? []).map((r: any) => r.id);

  let lessonsRows: any[] = [];
  if (taIds.length > 0) {
    const { data } = await supabase
      .from("lessons")
      .select(
        `
          id, subject, day_of_week, lesson_number, billing_type, for_psychology,
          class_id, track_id, specialization_id,
          classes(name), tracks(name), specializations(name),
          activity_ranges(name)
        `
      )
      .eq("academic_year_id", activeYear.id)
      .in("teacher_teaching_assignment_id", taIds);
    lessonsRows = data ?? [];
  }

  const lessonIds = lessonsRows.map((l: any) => l.id);

  const { data: slaRows } = await supabase
    .from("student_lesson_assignments")
    .select("lesson_id, student_id")
    .in("lesson_id", lessonIds.length > 0 ? lessonIds : ["00000000-0000-0000-0000-000000000000"])
    .is("end_date", null);

  const studentCountByLesson = new Map<string, Set<string>>();
  for (const row of slaRows ?? []) {
    const key = row.lesson_id as string;
    const set = studentCountByLesson.get(key) ?? new Set<string>();
    set.add(row.student_id as string);
    studentCountByLesson.set(key, set);
  }

  const entries: TimetableEntry[] = lessonsRows.map((l: any) => {
    const cls = l.classes as unknown as { name: string } | null;
    const tr = l.tracks as unknown as { name: string } | null;
    const spec = l.specializations as unknown as { name: string } | null;

    let audienceLabel = "—";
    if (l.billing_type === "specialization") audienceLabel = spec?.name ?? "—";
    else audienceLabel = cls?.name ?? tr?.name ?? "—";

    return {
      lessonId: l.id,
      subject: l.subject,
      teacherName: teacher.full_name,
      teacherId: teacher.id,
      dayOfWeek: l.day_of_week,
      lessonNumber: l.lesson_number,
      billingType: l.billing_type,
      forPsychology: l.for_psychology,
      audienceLabel,
    };
  });

  const initial = teacher.full_name?.[0] ?? "?";

  return (
    <div className="flex flex-col gap-gutter">
      {/* Teacher header card with avatar */}
      <section className="rounded-xl border border-outline-variant/30 border-t-4 border-t-secondary bg-surface-container-lowest p-6 shadow-tactile-md">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-6">
            <span
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-outline-variant bg-secondary-container font-title-lg text-title-lg font-bold text-primary"
            >
              {initial}
            </span>
            <div>
              <h2 className="mb-1 font-headline-lg text-headline-lg text-primary">
                {teacher.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 font-body-md text-body-md text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="badge" className="text-[18px]" />
                  ת&quot;ז: {teacher.identity_number ?? "—"}
                </span>
                {teacher.is_local && <StatusPill tone="warn">מקומית</StatusPill>}
              </div>
            </div>
          </div>
          <Link
            href={`/timetable?teacherId=${teacher.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-2.5 font-label-md text-label-md text-on-secondary shadow-tactile-sm transition-all hover:-translate-y-0.5 hover:bg-secondary-fixed-dim"
          >
            <Icon name="calendar_view_week" className="text-[18px]" />
            פתח מערכת שעות
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-3">
        <Section icon="contact_phone" title="פרטי מורה">
          <dl className="flex flex-col gap-3 font-body-md text-body-md">
            <div>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                טלפון
              </dt>
              <dd className="text-on-surface" dir="ltr">
                {teacher.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                אימייל
              </dt>
              <dd className="text-on-surface" dir="ltr">
                {teacher.email ?? "—"}
              </dd>
            </div>
          </dl>
        </Section>

        <div className="xl:col-span-2">
          <Section
            icon="calendar_view_week"
            title="מערכת שעות אישית (לפי השנה הפעילה)"
            bodyBleed
          >
            <div className="p-4">
              {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    אין שיעורים לשנה הפעילה עבור מורה זו.
                  </p>
                </div>
              ) : (
                <WeeklyTimetableGrid entries={entries} />
              )}
            </div>
          </Section>
        </div>
      </div>

      <Section icon="menu_book" title="טבלת שיעורים">
        {lessonsRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
            <Icon name="menu_book" className="mb-2 block text-[36px] text-secondary" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              עדיין אין שיעורים למורה זו.
            </p>
          </div>
        ) : (
          <Table
            headers={[
              "מקצוע",
              "סוג",
              "קהל יעד",
              "יום×שעה",
              "תלמידות פעילות",
              "פעולות",
            ]}
          >
            {lessonsRows.map((l: any) => {
              const cls = l.classes as unknown as { name: string } | null;
              const tr = l.tracks as unknown as { name: string } | null;
              const spec = l.specializations as unknown as { name: string } | null;

              let audienceLabel = "—";
              if (l.billing_type === "specialization")
                audienceLabel = spec?.name ?? "—";
              else audienceLabel = cls?.name ?? tr?.name ?? "—";

              const studentCount = studentCountByLesson.get(l.id)?.size ?? 0;

              return (
                <TableRow key={l.id}>
                  <TableCell className="font-semibold text-primary">
                    {l.subject}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={l.for_psychology ? "info" : "muted"}>
                      {l.for_psychology
                        ? "פסיכולוגיה"
                        : BILLING_TYPE_LABELS[
                            l.billing_type as keyof typeof BILLING_TYPE_LABELS
                          ]}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {audienceLabel}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {days[l.day_of_week] ?? "—"} · {l.lesson_number}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {studentCount}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/timetable?teacherId=${teacher.id}&subject=${encodeURIComponent(l.subject)}`}
                      className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:underline"
                    >
                      <Icon name="filter_alt" className="text-[16px]" />
                      סנן
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </Section>
    </div>
  );
}

