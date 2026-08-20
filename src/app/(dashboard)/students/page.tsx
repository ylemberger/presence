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

  const assignments: Record<
    string,
    { className: string; gradeName: string; trackName: string; specializationName: string }
  > = {};

  let yearOptions = null;

  if (activeYear) {
    const [
      { data: currentAssignments },
      { data: grades },
      { data: classes },
      { data: tracks },
      { data: specializations },
    ] = await Promise.all([
      supabase
        .from("student_assignments")
        .select("student_id, classes(name), grades(name), tracks(name), specializations(name)")
        .eq("academic_year_id", activeYear.id)
        .is("end_date", null),
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("specializations")
        .select("*")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
    ]);

    for (const a of currentAssignments ?? []) {
      assignments[a.student_id] = {
        className: (a.classes as unknown as { name: string } | null)?.name ?? "לא משובצת",
        gradeName: (a.grades as unknown as { name: string } | null)?.name ?? "—",
        trackName: (a.tracks as unknown as { name: string } | null)?.name ?? "—",
        specializationName:
          (a.specializations as unknown as { name: string } | null)?.name ?? "—",
      };
    }

    yearOptions = {
      yearId: activeYear.id,
      grades: grades ?? [],
      classes: classes ?? [],
      tracks: tracks ?? [],
      specializations: specializations ?? [],
    };
  }

  const rows = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    identity_number: s.identity_number,
    is_active: s.is_active,
    className: assignments[s.id]?.className ?? "לא משובצת",
    gradeName: assignments[s.id]?.gradeName ?? "—",
    trackName: assignments[s.id]?.trackName ?? "—",
    specializationName: assignments[s.id]?.specializationName ?? "—",
  }));

  return (
    <div>
      <PageHeader
        title="תלמידות"
        description="כרטסת קבועה. בעת יצירה ממלאים שכבה, כיתה ומסלול. שינוי נעשה בהעברה בלבד, עם היסטוריה."
      />
      <StudentsDirectory students={rows} yearOptions={yearOptions} />
    </div>
  );
}
