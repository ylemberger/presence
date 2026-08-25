import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { filterFixedGrades } from "@/lib/years/grades";
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
      { data: currentAssignments, error: assignmentsError },
      { data: grades },
      { data: classes },
      { data: tracks },
      { data: specializations },
    ] = await Promise.all([
      supabase
        .from("student_assignments")
        .select(
          "student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology"
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

    if (assignmentsError) {
      console.error("student_assignments load failed", assignmentsError.message);
    }

    const gradeNameById = new Map((grades ?? []).map((g) => [g.id, g.name]));
    const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
    const trackNameById = new Map((tracks ?? []).map((t) => [t.id, t.name]));
    const specNameById = new Map((specializations ?? []).map((s) => [s.id, s.name]));

    for (const a of currentAssignments ?? []) {
      assignments[a.student_id] = {
        className: classNameById.get(a.class_id) ?? "לא משובצת",
        gradeName: gradeNameById.get(a.grade_id) ?? "—",
        trackName: trackNameById.get(a.track_id) ?? "—",
        specializationName: a.specialization_id
          ? specNameById.get(a.specialization_id) ?? "—"
          : "—",
        secondarySpecializationName: a.secondary_specialization_id
          ? specNameById.get(a.secondary_specialization_id) ?? "—"
          : "—",
        isPsychology: Boolean(a.is_psychology),
      };
    }

    yearOptions = {
      yearId: activeYear.id,
      grades: filterFixedGrades(grades ?? []),
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
        description="כרטסת קבועה עם מחזור. אפשר להוסיף אחת-אחת או לייבא מאקסל. שינוי שיבוץ באמצע השנה — בהעברה."
      />
      <StudentsDirectory students={rows} yearOptions={yearOptions} />
    </div>
  );
}
