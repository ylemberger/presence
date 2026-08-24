import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { WeeklyTimetableGrid, type TimetableEntry } from "@/components/timetable/WeeklyTimetableGrid";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { hebrewWeekdayLabels } from "@/lib/dates/hebrew";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={teacher.full_name}
        description={`ת\"ז ${teacher.identity_number}${teacher.is_local ? " · מקומית" : ""}`}
        actions={
          <Link
            href={`/timetable?teacherId=${teacher.id}`}
            className="inline-flex items-center rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-soft)]"
          >
            פתח מערכת שעות
          </Link>
        }
      />

      <Card title="פרטי מורה">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-500">טלפון</div>
            <div className="text-sm text-slate-800">{teacher.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">אימייל</div>
            <div className="text-sm text-slate-800">{teacher.email ?? "—"}</div>
          </div>
        </div>
      </Card>

      <Card title="מערכת שעות אישית (לפי השנה הפעילה)">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-600">אין שיעורים לשנה הפעילה עבור מורה זו.</p>
        ) : (
          <WeeklyTimetableGrid entries={entries} />
        )}
      </Card>

      <Card title="טבלת שיעורים">
        {lessonsRows.length === 0 ? (
          <p className="text-sm text-slate-600">עדיין אין שיעורים למורה זו.</p>
        ) : (
          <Table
            headers={["מקצוע", "סוג", "קהל יעד", "יום×שעה", "תלמידות פעילות", "לפתיחה בטבלת מערכת שעות"]}
          >
            {lessonsRows.map((l: any) => {
              const cls = l.classes as unknown as { name: string } | null;
              const tr = l.tracks as unknown as { name: string } | null;
              const spec = l.specializations as unknown as { name: string } | null;

              let audienceLabel = "—";
              if (l.billing_type === "specialization") audienceLabel = spec?.name ?? "—";
              else audienceLabel = cls?.name ?? tr?.name ?? "—";

              const studentCount = studentCountByLesson.get(l.id)?.size ?? 0;

              return (
                <TableRow key={l.id}>
                  <TableCell>{l.subject}</TableCell>
                  <TableCell>
                    {l.for_psychology
                      ? "פסיכולוגיה"
                      : BILLING_TYPE_LABELS[l.billing_type as keyof typeof BILLING_TYPE_LABELS]}
                  </TableCell>
                  <TableCell>{audienceLabel}</TableCell>
                  <TableCell>
                    {days[l.day_of_week] ?? "—"} · {l.lesson_number}
                  </TableCell>
                  <TableCell>{studentCount}</TableCell>
                  <TableCell>
                    <Link
                      href={`/timetable?teacherId=${teacher.id}&subject=${encodeURIComponent(l.subject)}`}
                      className="text-sm font-medium text-[var(--brand)] hover:underline"
                    >
                      סנן
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

