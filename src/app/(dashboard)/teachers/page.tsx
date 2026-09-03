import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { TeachersForms } from "./TeachersForms";
import { TeachersDirectory, type TeacherDirectoryRow } from "./TeachersDirectory";
import { TeachersLessons, type TeacherLessonRow } from "./TeachersLessons";
import { Icon } from "@/components/ui/Icon";
import { salaryDisplayFields } from "@/lib/teachers/salary-display";
import {
  fetchTeacherSourceRecords,
  groupSourceRowsByTeacher,
} from "@/lib/teachers/source-records";

type AssignmentRow = {
  id: string;
  subject: string;
  billing_type: "mandatory" | "specialization";
  for_psychology?: boolean;
  teachers: { full_name: string } | null;
  grades: { name: string } | null;
  classes: { name: string } | null;
  tracks: { name: string } | null;
  specializations: { name: string } | null;
};

function uniqueJoined(values: Array<string | null | undefined>): string {
  const list = [
    ...new Set(
      values
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    ),
  ];
  return list.length ? list.join(" · ") : "—";
}

export default async function TeachersPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: teachers } = await supabase.from("teachers").select("*").order("full_name");

  const sourceRows = await fetchTeacherSourceRecords(supabase);

  const identityToTeacherId = new Map(
    (teachers ?? []).map((t) => [t.identity_number, t.id])
  );
  const sourcesByTeacher = groupSourceRowsByTeacher(sourceRows, identityToTeacherId);

  const directoryRows: TeacherDirectoryRow[] = (teachers ?? []).map((t) => {
    const sources = sourcesByTeacher.get(t.id) ?? [];
    const fields = sources.map((s) => salaryDisplayFields(s));
    const meetings = fields
      .map((f) => f.meetings)
      .filter((n): n is number => typeof n === "number");
    return {
      id: t.id,
      full_name: t.full_name,
      identity_number: t.identity_number,
      phone: t.phone,
      email: t.email,
      is_local: t.is_local,
      salarySubjects: uniqueJoined(fields.map((f) => f.subject)),
      salaryTracks: uniqueJoined(fields.map((f) => f.track)),
      salaryGradeYears: uniqueJoined(fields.map((f) => f.year)),
      salarySemesters: uniqueJoined(fields.map((f) => f.semester)),
      salaryMeetings:
        meetings.length === 0
          ? "—"
          : String(meetings.reduce((a, b) => a + b, 0)),
    };
  });

  let lessonRows: TeacherLessonRow[] = [];

  if (activeYear) {
    const { data: asg } = await supabase
      .from("teacher_teaching_assignments")
      .select(
        "id, subject, billing_type, for_psychology, teachers(full_name), grades(name), classes(name), tracks(name), specializations(name)"
      )
      .eq("academic_year_id", activeYear.id)
      .order("subject");

    lessonRows = ((asg ?? []) as unknown as AssignmentRow[]).map((a) => ({
      id: a.id,
      teacherName: a.teachers?.full_name ?? "—",
      subject: a.subject,
      typeLabel: a.for_psychology
        ? "פסיכולוגיה"
        : BILLING_TYPE_LABELS[a.billing_type] ?? a.billing_type,
      grade: a.grades?.name ?? "—",
      audience: a.for_psychology
        ? "תלמידות פסיכולוגיה"
        : [a.classes?.name, a.tracks?.name, a.specializations?.name]
            .filter(Boolean)
            .join(" · ") || "—",
    }));
  }

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="מורות"
        description="מורות מגיעות ממערכת השכר אחרי אישור. אפשר לערוך פרטים מקומית."
        size="display"
      />

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <div className="lg:col-span-4 lg:row-span-2">
          <section className="rounded-xl border-t-4 border-secondary bg-surface-container-lowest p-stack_md shadow-tactile-md">
            <h3 className="mb-4 flex items-center gap-2 font-title-lg text-title-lg text-primary">
              <Icon name="sync" className="text-secondary" />
              סנכרון מורות
            </h3>
            <TeachersForms />
          </section>
        </div>

        <div className="min-w-0 lg:col-span-8">
          <TeachersDirectory teachers={directoryRows} />
        </div>

        {activeYear && (
          <div className="min-w-0 lg:col-span-8">
            <TeachersLessons rows={lessonRows} />
          </div>
        )}
      </div>
    </div>
  );
}
