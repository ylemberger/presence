import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { StudentsDirectory } from "./StudentsDirectory";

export default async function StudentsPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("full_name");

  const assignments: Record<string, { className: string; gradeName: string }> = {};

  if (activeYear) {
    const { data: currentAssignments } = await supabase
      .from("student_assignments")
      .select("student_id, classes(name), grades(name)")
      .eq("academic_year_id", activeYear.id)
      .is("end_date", null);

    for (const a of currentAssignments ?? []) {
      assignments[a.student_id] = {
        className: (a.classes as unknown as { name: string } | null)?.name ?? "לא משובצת",
        gradeName: (a.grades as unknown as { name: string } | null)?.name ?? "—",
      };
    }
  }

  const rows = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    identity_number: s.identity_number,
    is_active: s.is_active,
    className: assignments[s.id]?.className ?? "לא משובצת",
    gradeName: assignments[s.id]?.gradeName ?? "—",
  }));

  return (
    <div>
      <PageHeader
        title="תלמידות"
        description="כרטסת קבועה. העברה בין כיתות נשמרת בהיסטוריית שיבוצים, בלי למחוק תלמידה."
      />
      <StudentsDirectory students={rows} />
    </div>
  );
}
