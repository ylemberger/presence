import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { TeachersForms } from "./TeachersForms";
import { TeachersDirectory } from "./TeachersDirectory";
import { TeachersLessons, type TeacherLessonRow } from "./TeachersLessons";
import { Icon } from "@/components/ui/Icon";

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

export default async function TeachersPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("full_name");

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
        description="הוספה, עריכה וצפייה בשיבוצי מורות במערכת."
        size="display"
      />

      {/*
        Layout matches the provided teachers screenshot:
        form is a tall card on the right (RTL start), tables stack on the left.
      */}
      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <div className="lg:col-span-4 lg:row-span-2">
          <section className="rounded-xl border-t-4 border-secondary bg-surface-container-lowest p-stack_md shadow-tactile-md">
            <h3 className="mb-4 flex items-center gap-2 font-title-lg text-title-lg text-primary">
              <Icon name="person_add" className="text-secondary" />
              הוספת מורה
            </h3>
            <TeachersForms yearId={activeYear?.id} />
          </section>
        </div>

        <div className="lg:col-span-8">
          <TeachersDirectory teachers={teachers ?? []} />
        </div>

        {activeYear && (
          <div className="lg:col-span-8">
            <TeachersLessons rows={lessonRows} />
          </div>
        )}
      </div>
    </div>
  );
}
