import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { GenerateOccurrencesButton } from "./GenerateOccurrencesButton";
import { LessonsCalendar } from "./LessonsCalendar";
import { LessonsForm } from "./LessonsForm";
import { filterFixedGrades } from "@/lib/years/grades";
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

  const [lessons, teachers, grades, classes, tracks, specializations, ranges, rules, occurrences] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("*")
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

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="יומן שיעורים עברי"
        description="ניהול מערכת השעות, מופעים חריגים ומעקב נוכחות מורות."
        actions={<GenerateOccurrencesButton academicYearId={activeYear.id} />}
      />

      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-12">
        <div className="flex flex-col gap-gutter xl:col-span-4">
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
            lessons={lessons.data ?? []}
            formProps={formProps}
          />
        </div>
      </div>
    </div>
  );
}
