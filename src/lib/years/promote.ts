import { createClient } from "@/lib/supabase/server";

export const FIXED_GRADE_NAMES = ["א", "ב", "ג"] as const;

const GRADE_PROMOTE: Record<string, string | null> = {
  א: "ב",
  ב: "ג",
  ג: null,
};

export async function ensureFixedGrades(academicYearId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("grades")
    .select("id, name")
    .eq("academic_year_id", academicYearId);

  const have = new Set((existing ?? []).map((g) => g.name));
  const missing = FIXED_GRADE_NAMES.filter((n) => !have.has(n));
  if (missing.length === 0) return;

  await supabase.from("grades").insert(
    missing.map((name) => ({ academic_year_id: academicYearId, name }))
  );
}

export async function copyTeachingTypes(fromYearId: string, toYearId: string) {
  const supabase = await createClient();
  const { data: from } = await supabase
    .from("teaching_types")
    .select("name")
    .eq("academic_year_id", fromYearId);
  if (!from?.length) return;

  const { data: existing } = await supabase
    .from("teaching_types")
    .select("name")
    .eq("academic_year_id", toYearId);
  const have = new Set((existing ?? []).map((t) => t.name));
  const rows = from
    .filter((t) => !have.has(t.name))
    .map((t) => ({ academic_year_id: toYearId, name: t.name }));
  if (rows.length) await supabase.from("teaching_types").insert(rows);
}

export async function copyYearStructure(fromYearId: string, toYearId: string) {
  const supabase = await createClient();
  await ensureFixedGrades(toYearId);
  await copyTeachingTypes(fromYearId, toYearId);

  const [
    { data: fromGrades },
    { data: toGrades },
    { data: fromClasses },
    { data: toClasses },
    { data: fromTracks },
    { data: toTracks },
    { data: fromSpecs },
    { data: toSpecs },
  ] = await Promise.all([
    supabase.from("grades").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("grades").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", fromYearId),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("name").eq("academic_year_id", fromYearId),
    supabase.from("tracks").select("name").eq("academic_year_id", toYearId),
    supabase.from("specializations").select("name").eq("academic_year_id", fromYearId),
    supabase.from("specializations").select("name").eq("academic_year_id", toYearId),
  ]);

  const fromGradeName = new Map((fromGrades ?? []).map((g) => [g.id, g.name]));
  const toGradeByName = new Map((toGrades ?? []).map((g) => [g.name, g.id]));
  const haveClass = new Set((toClasses ?? []).map((c) => `${c.grade_id}::${c.name}`));

  const classRows = (fromClasses ?? [])
    .map((c) => {
      const gName = fromGradeName.get(c.grade_id);
      const nextGradeId = gName ? toGradeByName.get(gName) : undefined;
      if (!nextGradeId) return null;
      if (haveClass.has(`${nextGradeId}::${c.name}`)) return null;
      return { academic_year_id: toYearId, grade_id: nextGradeId, name: c.name };
    })
    .filter(Boolean) as Array<{ academic_year_id: string; grade_id: string; name: string }>;
  if (classRows.length) await supabase.from("classes").insert(classRows);

  const haveTrack = new Set((toTracks ?? []).map((t) => t.name));
  const trackRows = (fromTracks ?? [])
    .filter((t) => !haveTrack.has(t.name))
    .map((t) => ({ academic_year_id: toYearId, name: t.name }));
  if (trackRows.length) await supabase.from("tracks").insert(trackRows);

  const haveSpec = new Set((toSpecs ?? []).map((s) => s.name));
  const specRows = (fromSpecs ?? [])
    .filter((s) => !haveSpec.has(s.name))
    .map((s) => ({ academic_year_id: toYearId, name: s.name }));
  if (specRows.length) await supabase.from("specializations").insert(specRows);
}

/**
 * Promote active placements: א→ב, ב→ג, ג→ inactive (history kept).
 * Copies structure first, then maps class/track/spec/teaching_type by name.
 */
export async function promoteStudentsToYear(fromYearId: string, toYearId: string) {
  const supabase = await createClient();
  await copyYearStructure(fromYearId, toYearId);

  const [
    { data: fromGrades },
    { data: toGrades },
    { data: toClasses },
    { data: toTracks },
    { data: fromSpecs },
    { data: toSpecs },
    { data: fromTypes },
    { data: toTypes },
    { data: placements },
  ] = await Promise.all([
    supabase.from("grades").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("grades").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("teaching_types").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("teaching_types").select("id, name").eq("academic_year_id", toYearId),
    supabase
      .from("student_assignments")
      .select(
        "student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, teaching_type_id, is_psychology, classes(name), tracks(name), students(id, is_active)"
      )
      .eq("academic_year_id", fromYearId)
      .is("end_date", null),
  ]);

  const fromGradeName = new Map((fromGrades ?? []).map((g) => [g.id, g.name]));
  const toGradeByName = new Map((toGrades ?? []).map((g) => [g.name, g.id]));
  const toTrackByName = new Map((toTracks ?? []).map((t) => [t.name, t.id]));
  const fromSpecName = new Map((fromSpecs ?? []).map((s) => [s.id, s.name]));
  const toSpecByName = new Map((toSpecs ?? []).map((s) => [s.name, s.id]));
  const fromTypeName = new Map((fromTypes ?? []).map((t) => [t.id, t.name]));
  const toTypeByName = new Map((toTypes ?? []).map((t) => [t.name, t.id]));

  let promoted = 0;
  let graduated = 0;
  let skipped = 0;
  const startDate = new Date().toISOString().slice(0, 10);

  for (const p of placements ?? []) {
    const student = p.students as unknown as { id: string; is_active: boolean } | null;
    if (!student?.is_active) continue;

    const gradeName = fromGradeName.get(p.grade_id) ?? "";
    const nextGradeName = GRADE_PROMOTE[gradeName];

    if (nextGradeName === null) {
      await supabase.from("students").update({ is_active: false }).eq("id", p.student_id);
      graduated++;
      continue;
    }
    if (!nextGradeName) {
      skipped++;
      continue;
    }

    const nextGradeId = toGradeByName.get(nextGradeName);
    if (!nextGradeId) {
      skipped++;
      continue;
    }

    const className = (p.classes as unknown as { name: string } | null)?.name;
    const nextClass =
      (toClasses ?? []).find((c) => c.grade_id === nextGradeId && c.name === className) ??
      (toClasses ?? []).find((c) => c.grade_id === nextGradeId);
    if (!nextClass) {
      skipped++;
      continue;
    }

    const trackName = (p.tracks as unknown as { name: string } | null)?.name;
    const nextTrackId = trackName ? toTrackByName.get(trackName) : undefined;
    if (!nextTrackId) {
      skipped++;
      continue;
    }

    const specName = p.specialization_id ? fromSpecName.get(p.specialization_id) : null;
    const secondaryName = p.secondary_specialization_id
      ? fromSpecName.get(p.secondary_specialization_id)
      : null;
    const typeName = p.teaching_type_id ? fromTypeName.get(p.teaching_type_id) : null;

    const { error } = await supabase.from("student_assignments").insert({
      student_id: p.student_id,
      academic_year_id: toYearId,
      grade_id: nextGradeId,
      class_id: nextClass.id,
      track_id: nextTrackId,
      specialization_id: specName ? toSpecByName.get(specName) ?? null : null,
      secondary_specialization_id: secondaryName
        ? toSpecByName.get(secondaryName) ?? null
        : null,
      teaching_type_id: typeName ? toTypeByName.get(typeName) ?? null : null,
      is_psychology: Boolean(p.is_psychology),
      start_date: startDate,
      end_date: null,
    });

    if (error) skipped++;
    else promoted++;
  }

  return { promoted, graduated, skipped };
}
