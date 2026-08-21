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
    {
      className: string;
      gradeName: string;
      trackName: string;
      specializationName: string;
      secondarySpecializationName: string;
      isPsychology: boolean;
    }
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
        .select(
          "student_id, is_psychology, classes(name), grades(name), tracks(name), specializations(name), secondary_specialization_id"
        )
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

    const specNameById = new Map((specializations ?? []).map((s) => [s.id, s.name]));

    for (const a of currentAssignments ?? []) {
      assignments[a.student_id] = {
        className: (a.classes as unknown as { name: string } | null)?.name ?? "לא משובצת",
        gradeName: (a.grades as unknown as { name: string } | null)?.name ?? "—",
        trackName: (a.tracks as unknown as { name: string } | null)?.name ?? "—",
        specializationName:
          (a.specializations as unknown as { name: string } | null)?.name ?? "—",
        secondarySpecializationName: a.secondary_specialization_id
          ? specNameById.get(a.secondary_specialization_id) ?? "—"
          : "—",
        isPsychology: Boolean(a.is_psychology),
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
    cohort_number: s.cohort_number ?? 1,
    is_active: s.is_active,
    className: assignments[s.id]?.className ?? "לא משובצת",
    gradeName: assignments[s.id]?.gradeName ?? "—",
    trackName: assignments[s.id]?.trackName ?? "—",
    specializationName: assignments[s.id]?.specializationName ?? "—",
    secondarySpecializationName: assignments[s.id]?.secondarySpecializationName ?? "—",
    isPsychology: assignments[s.id]?.isPsychology ?? false,
  }));

  return (
    <div>
      <PageHeader
        title="תלמידות"
        description="כרטסת קבועה עם מחזור. בעת יצירה ממלאים שכבה/כיתה/מסלול. שינוי נעשה בהעברה בלבד."
      />
      <StudentsDirectory students={rows} yearOptions={yearOptions} />
    </div>
  );
}
