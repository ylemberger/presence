import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { GenerateOccurrencesButton } from "./GenerateOccurrencesButton";
import { LessonsCalendar } from "./LessonsCalendar";
import type { TeachingAssignmentOption } from "./LessonsForm";
import {
  buildHebrewMonth,
  hebrewMonthFromIso,
  todayIso,
} from "@/lib/dates/hebrew";

interface Props {
  searchParams: { from?: string; to?: string };
}

export default async function LessonsPage({ searchParams }: Props) {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader title="שיעורים" description="יש להגדיר שנה אקדמית פעילה תחילה." />
      </div>
    );
  }

  const monthSeed = hebrewMonthFromIso(searchParams.from || todayIso());
  const month = buildHebrewMonth(monthSeed.year, monthSeed.month);
  const from = searchParams.from || month.rangeStart;
  const to = searchParams.to || month.rangeEnd;

  const [lessons, teachingAssignments, grades, ranges, rules, occurrences] = await Promise.all([
    supabase
      .from("lessons")
      .select("*")
      .eq("academic_year_id", activeYear.id)
      .order("day_of_week"),
    supabase
      .from("teacher_teaching_assignments")
      .select(
        "id, subject, billing_type, teachers(full_name), classes(name), tracks(name), specializations(name)"
      )
      .eq("academic_year_id", activeYear.id),
    supabase.from("grades").select("*").eq("academic_year_id", activeYear.id),
    supabase.from("activity_ranges").select("*").eq("academic_year_id", activeYear.id),
    supabase.from("attendance_rules").select("*"),
    supabase
      .from("lesson_occurrences")
      .select("id, occurrence_date, status, notes, lesson_id, lessons!inner(subject, academic_year_id)")
      .eq("lessons.academic_year_id", activeYear.id)
      .gte("occurrence_date", from)
      .lte("occurrence_date", to)
      .order("occurrence_date"),
  ]);

  const occurrenceRows = (occurrences.data ?? []).map((o) => ({
    id: o.id,
    occurrence_date: o.occurrence_date,
    status: o.status,
    notes: o.notes,
    lesson_id: o.lesson_id,
    subject: (o.lessons as unknown as { subject: string } | null)?.subject ?? "",
  }));

  const teachingOptions: TeachingAssignmentOption[] = (teachingAssignments.data ?? []).map(
    (t) => ({
      id: t.id,
      subject: t.subject,
      billing_type: (t.billing_type as "mandatory" | "specialization") ?? "mandatory",
      teachers: t.teachers as unknown as { full_name: string } | null,
      className: (t.classes as unknown as { name: string } | null)?.name ?? null,
      trackName: (t.tracks as unknown as { name: string } | null)?.name ?? null,
      specializationName:
        (t.specializations as unknown as { name: string } | null)?.name ?? null,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="יומן שיעורים עברי"
        description="סוג השיעור (חובה/התמחות) נקבע לפי שיבוץ ההוראה של המורה."
        actions={<GenerateOccurrencesButton academicYearId={activeYear.id} />}
      />
      <LessonsCalendar
        yearId={activeYear.id}
        initialMonthIso={from}
        occurrences={occurrenceRows}
        lessons={lessons.data ?? []}
        teachingAssignments={teachingOptions}
        grades={grades.data ?? []}
        ranges={ranges.data ?? []}
        rules={rules.data ?? []}
      />
    </div>
  );
}
