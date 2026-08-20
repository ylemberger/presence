import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { LessonsForm } from "./LessonsForm";
import { GenerateOccurrencesButton } from "./GenerateOccurrencesButton";
import { OccurrenceActions } from "./OccurrenceActions";

export default async function LessonsPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">שיעורים</h1>
        <p className="mt-4 text-gray-600">יש להגדיר שנה אקדמית פעילה תחילה.</p>
      </div>
    );
  }

  const [lessons, teachingAssignments, grades, classes, tracks, specializations, ranges, rules, occurrences] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("*")
        .eq("academic_year_id", activeYear.id)
        .order("day_of_week"),
      supabase
        .from("teacher_teaching_assignments")
        .select("id, subject, teachers(full_name)")
        .eq("academic_year_id", activeYear.id),
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("specializations").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("activity_ranges").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("attendance_rules").select("*"),
      supabase
        .from("lesson_occurrences")
        .select("*, lessons!inner(subject, academic_year_id)")
        .eq("lessons.academic_year_id", activeYear.id)
        .order("occurrence_date", { ascending: false })
        .limit(50),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">שיעורים</h1>
        <GenerateOccurrencesButton academicYearId={activeYear.id} />
      </div>

      <Card title="יצירת תבנית שיעור">
        <LessonsForm
          yearId={activeYear.id}
          teachingAssignments={(teachingAssignments.data ?? []) as unknown as Array<{
            id: string;
            subject: string;
            teachers: { full_name: string };
          }>}
          grades={grades.data ?? []}
          classes={classes.data ?? []}
          tracks={tracks.data ?? []}
          specializations={specializations.data ?? []}
          ranges={ranges.data ?? []}
          rules={rules.data ?? []}
        />
      </Card>

      <Card title="תבניות שיעור">
        <Table
          headers={["מקצוע", "יום", "שיעור", "סוג", "שכבה"]}
        >
          {(lessons.data ?? []).map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.subject}</TableCell>
              <TableCell>{DAY_OF_WEEK_LABELS[l.day_of_week]}</TableCell>
              <TableCell>{l.lesson_number}</TableCell>
              <TableCell>{BILLING_TYPE_LABELS[l.billing_type as keyof typeof BILLING_TYPE_LABELS]}</TableCell>
              <TableCell>
                {(grades.data ?? []).find((g) => g.id === l.grade_id)?.name ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>

      <Card title="מופעי שיעור (50 אחרונים)">
        <Table headers={["מקצוע", "תאריך", "סטטוס", "פעולות"]}>
          {(occurrences.data ?? []).map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                {(o.lessons as unknown as { subject: string } | null)?.subject}
              </TableCell>
              <TableCell>{o.occurrence_date}</TableCell>
              <TableCell>{o.status}</TableCell>
              <TableCell>
                {o.status !== "cancelled" && (
                  <OccurrenceActions occurrenceId={o.id} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}
