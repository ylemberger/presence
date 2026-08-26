import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { filterFixedGrades } from "@/lib/years/grades";
import { StudentsDirectory } from "./StudentsDirectory";
import { RepairPromotionsButton } from "../settings/RepairPromotionsButton";

type YearAssignment = {
  student_id: string;
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  start_date: string;
  end_date: string | null;
};

/** Prefer open placement; otherwise the latest assignment in that year (archive). */
function pickPlacementForYear(rows: YearAssignment[]): Map<string, YearAssignment> {
  const byStudent = new Map<string, YearAssignment>();
  const sorted = [...rows].sort((a, b) => {
    if (a.end_date === null && b.end_date !== null) return -1;
    if (a.end_date !== null && b.end_date === null) return 1;
    return b.start_date.localeCompare(a.start_date);
  });
  for (const row of sorted) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, row);
  }
  return byStudent;
}

export default async function StudentsPage() {
  const activeYear = await getActiveAcademicYear();
  const allYears = await getAllAcademicYears();
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
  const placedStudentIds = new Set<string>();

  if (activeYear) {
    const [
      { data: yearAssignments, error: assignmentsError },
      { data: grades },
      { data: classes },
      { data: tracks },
      { data: specializations },
    ] = await Promise.all([
      supabase
        .from("student_assignments")
        .select(
          "student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date, end_date"
        )
        .eq("academic_year_id", activeYear.id),
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

    const picked = pickPlacementForYear((yearAssignments ?? []) as YearAssignment[]);
    for (const [studentId, a] of picked) {
      placedStudentIds.add(studentId);
      assignments[studentId] = {
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

  const rows = (students ?? [])
    .filter((s) => placedStudentIds.has(s.id) || s.is_active)
    .map((s) => ({
      id: s.id,
      full_name: s.full_name,
      first_name: s.first_name ?? "",
      last_name: s.last_name ?? "",
      mi: s.mi ?? null,
      identity_number: s.identity_number,
      cohort_number: s.cohort_number ?? 1,
      city: s.city ?? null,
      phone: s.phone ?? null,
      father_phone: s.father_phone ?? null,
      mother_phone: s.mother_phone ?? null,
      student_phone: s.student_phone ?? null,
      high_school: s.high_school ?? null,
      chetz_program: Boolean(s.chetz_program),
      birth_date: s.birth_date ?? null,
      birth_date_hebrew: s.birth_date_hebrew ?? null,
      address: s.address ?? null,
      personal_note: s.personal_note ?? null,
      is_active: s.is_active,
      className: assignments[s.id]?.className ?? "לא משובצת",
      gradeName: assignments[s.id]?.gradeName ?? "—",
      trackName: assignments[s.id]?.trackName ?? "—",
      specializationName: assignments[s.id]?.specializationName ?? "—",
      secondarySpecializationName: assignments[s.id]?.secondarySpecializationName ?? "—",
      isPsychology: assignments[s.id]?.isPsychology ?? false,
    }));

  const activeUnplaced = rows.filter((s) => s.is_active && !placedStudentIds.has(s.id)).length;
  const yearIdx = allYears.findIndex((y) => y.id === activeYear?.id);
  const previousYear = yearIdx >= 0 ? allYears[yearIdx + 1] : allYears[1];

  return (
    <div>
      <PageHeader
        title="תלמידות"
        description="כרטסת קבועה עם מחזור. שיבוץ (שכבה/כיתה/מסלול) לפי השנה שנבחרה למעלה. בארכיון רואים את מה שהיה באותה שנה."
      />
      {activeUnplaced > 0 && previousYear && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-secondary-container/40 p-4">
          <p className="mb-2 text-body-md font-medium text-on-surface">
            {activeUnplaced} תלמידות פעילות בלי שיבוץ בשנה הנוכחית
          </p>
          <RepairPromotionsButton
            missingCount={activeUnplaced}
            previousYearName={previousYear.name}
          />
        </div>
      )}
      <StudentsDirectory students={rows} yearOptions={yearOptions} />
    </div>
  );
}
