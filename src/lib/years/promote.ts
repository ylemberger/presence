import { createClient } from "@/lib/supabase/server";
import { addDays, todayIso } from "@/lib/dates/hebrew";
import { FIXED_GRADE_NAMES } from "@/lib/years/grades";
import type { SupabaseClient } from "@supabase/supabase-js";

const GRADE_PROMOTE: Record<string, string | null> = {
  א: "ב",
  ב: "ג",
  ג: null,
};

export const YEAR_G_CLASS_NAME = "שנה ג";

/** Map class name when promoting grades (א→ב: יג→יד; ב→ג: שנה ג). */
export function mapPromotedClassName(
  fromGrade: string,
  toGrade: string,
  className: string
): string {
  if (toGrade === "ג") return YEAR_G_CLASS_NAME;
  if (fromGrade === "א" && toGrade === "ב") {
    return className.replace(/יג/g, "יד");
  }
  return className;
}

export async function ensureFixedGrades(
  academicYearId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());
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

async function ensureNamedEntity(
  supabase: SupabaseClient,
  table: "tracks" | "specializations",
  academicYearId: string,
  name: string,
  byName: Map<string, string>
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = byName.get(trimmed);
  if (existing) return existing;

  const { data, error } = await supabase
    .from(table)
    .insert({ academic_year_id: academicYearId, name: trimmed })
    .select("id, name")
    .single();
  if (error || !data) return null;
  byName.set(data.name, data.id);
  return data.id;
}

async function ensureClass(
  supabase: SupabaseClient,
  academicYearId: string,
  gradeId: string,
  name: string,
  classes: Array<{ id: string; name: string; grade_id: string }>
): Promise<{ id: string; name: string; grade_id: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const found = classes.find((c) => c.grade_id === gradeId && c.name === trimmed);
  if (found) return found;

  const { data, error } = await supabase
    .from("classes")
    .insert({ academic_year_id: academicYearId, grade_id: gradeId, name: trimmed })
    .select("id, name, grade_id")
    .single();
  if (error || !data) return null;
  classes.push(data);
  return data;
}

/**
 * Build catalog for the new year:
 * - Grade א: copy class names from previous א (template for new first-years)
 * - Grade ב: classes from previous א with יג→יד
 * - Grade ג: single class "שנה ג"
 * - Tracks / specializations: copy by name
 */
export async function copyYearStructure(fromYearId: string, toYearId: string) {
  const supabase = await createClient();
  await ensureFixedGrades(toYearId, supabase);

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

  const gradeAId = toGradeByName.get("א");
  const gradeBId = toGradeByName.get("ב");
  const gradeCId = toGradeByName.get("ג");

  const fromGradeAClasses = (fromClasses ?? []).filter(
    (c) => fromGradeName.get(c.grade_id) === "א"
  );

  const classRows: Array<{ academic_year_id: string; grade_id: string; name: string }> = [];

  if (gradeAId) {
    for (const c of fromGradeAClasses) {
      const key = `${gradeAId}::${c.name}`;
      if (haveClass.has(key)) continue;
      haveClass.add(key);
      classRows.push({ academic_year_id: toYearId, grade_id: gradeAId, name: c.name });
    }
  }

  if (gradeBId) {
    for (const c of fromGradeAClasses) {
      const nextName = mapPromotedClassName("א", "ב", c.name);
      const key = `${gradeBId}::${nextName}`;
      if (haveClass.has(key)) continue;
      haveClass.add(key);
      classRows.push({ academic_year_id: toYearId, grade_id: gradeBId, name: nextName });
    }
  }

  if (gradeCId) {
    const key = `${gradeCId}::${YEAR_G_CLASS_NAME}`;
    if (!haveClass.has(key)) {
      haveClass.add(key);
      classRows.push({
        academic_year_id: toYearId,
        grade_id: gradeCId,
        name: YEAR_G_CLASS_NAME,
      });
    }
  }

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
 * Promote open placements: א→ב, ב→ג, ג→ archive.
 * Always closes the old assignment before opening the new one (overlap trigger).
 */
export async function promoteStudentsToYear(fromYearId: string, toYearId: string) {
  const supabase = await createClient();
  await copyYearStructure(fromYearId, toYearId);

  const [
    { data: fromGrades },
    { data: toGrades },
    { data: toClassesRaw },
    { data: toTracks },
    { data: fromTracks },
    { data: fromSpecs },
    { data: toSpecs },
    { data: placements },
  ] = await Promise.all([
    supabase.from("grades").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("grades").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", fromYearId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", toYearId),
    supabase
      .from("student_assignments")
      .select(
        "id, student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, classes(name), tracks(name), students(id, is_active)"
      )
      .eq("academic_year_id", fromYearId)
      .is("end_date", null),
  ]);

  const fromGradeName = new Map((fromGrades ?? []).map((g) => [g.id, g.name]));
  const toGradeByName = new Map((toGrades ?? []).map((g) => [g.name, g.id]));
  const toClasses = [...(toClassesRaw ?? [])];
  const toTrackByName = new Map((toTracks ?? []).map((t) => [t.name, t.id]));
  const fromTrackName = new Map((fromTracks ?? []).map((t) => [t.id, t.name]));
  const fromSpecName = new Map((fromSpecs ?? []).map((s) => [s.id, s.name]));
  const toSpecByName = new Map((toSpecs ?? []).map((s) => [s.name, s.id]));

  let promoted = 0;
  let graduated = 0;
  let skipped = 0;
  const startDate = todayIso();
  const endDate = addDays(startDate, -1);

  for (const p of placements ?? []) {
    const student = p.students as unknown as { id: string; is_active: boolean } | null;
    if (!student?.is_active) continue;

    const gradeName = fromGradeName.get(p.grade_id) ?? "";
    const nextGradeName = GRADE_PROMOTE[gradeName];

    // Close old placement first (required by overlap trigger)
    const { error: closeError } = await supabase
      .from("student_assignments")
      .update({ end_date: endDate })
      .eq("id", p.id);
    if (closeError) {
      skipped++;
      continue;
    }

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

    const oldClassName = (p.classes as unknown as { name: string } | null)?.name ?? "";
    const nextClassName = mapPromotedClassName(gradeName, nextGradeName, oldClassName);
    const nextClass = await ensureClass(
      supabase,
      toYearId,
      nextGradeId,
      nextClassName,
      toClasses
    );
    if (!nextClass) {
      skipped++;
      continue;
    }

    const trackName =
      (p.tracks as unknown as { name: string } | null)?.name ??
      fromTrackName.get(p.track_id) ??
      "";
    const nextTrackId = await ensureNamedEntity(
      supabase,
      "tracks",
      toYearId,
      trackName,
      toTrackByName
    );
    if (!nextTrackId) {
      skipped++;
      continue;
    }

    const specName = p.specialization_id ? fromSpecName.get(p.specialization_id) : null;
    const secondaryName = p.secondary_specialization_id
      ? fromSpecName.get(p.secondary_specialization_id)
      : null;

    const nextSpecId = specName
      ? await ensureNamedEntity(supabase, "specializations", toYearId, specName, toSpecByName)
      : null;
    const nextSecondaryId = secondaryName
      ? await ensureNamedEntity(
          supabase,
          "specializations",
          toYearId,
          secondaryName,
          toSpecByName
        )
      : null;

    const { error } = await supabase.from("student_assignments").insert({
      student_id: p.student_id,
      academic_year_id: toYearId,
      grade_id: nextGradeId,
      class_id: nextClass.id,
      track_id: nextTrackId,
      specialization_id: nextSpecId,
      secondary_specialization_id: nextSecondaryId,
      is_psychology: Boolean(p.is_psychology),
      start_date: startDate,
      end_date: null,
    });

    if (error) skipped++;
    else promoted++;
  }

  return { promoted, graduated, skipped };
}
