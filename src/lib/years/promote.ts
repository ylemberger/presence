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
export async function copyYearStructure(
  fromYearId: string,
  toYearId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());
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

type PlacementRow = {
  id: string;
  student_id: string;
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  start_date: string;
  end_date: string | null;
  classes: { name: string } | null;
  tracks: { name: string } | null;
  students: { id: string; is_active: boolean } | null;
};

function pickLatestPlacementPerStudent(rows: PlacementRow[]): PlacementRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.end_date === null && b.end_date !== null) return -1;
    if (a.end_date !== null && b.end_date === null) return 1;
    return b.start_date.localeCompare(a.start_date);
  });
  const seen = new Set<string>();
  const out: PlacementRow[] = [];
  for (const row of sorted) {
    if (seen.has(row.student_id)) continue;
    seen.add(row.student_id);
    out.push(row);
  }
  return out;
}

async function applyPromotionFromPlacement(
  supabase: SupabaseClient,
  p: PlacementRow,
  args: {
    fromYearId: string;
    toYearId: string;
    fromGradeName: Map<string, string>;
    toGradeByName: Map<string, string>;
    toClasses: Array<{ id: string; name: string; grade_id: string }>;
    toTrackByName: Map<string, string>;
    fromTrackName: Map<string, string>;
    fromSpecName: Map<string, string>;
    toSpecByName: Map<string, string>;
    startDate: string;
    endDate: string;
  }
): Promise<"promoted" | "graduated" | "skipped"> {
  const student = p.students;
  if (!student?.is_active) return "skipped";

  const gradeName = args.fromGradeName.get(p.grade_id) ?? "";
  const nextGradeName = GRADE_PROMOTE[gradeName];

  if (p.end_date === null) {
    const { error: closeError } = await supabase
      .from("student_assignments")
      .update({ end_date: args.endDate })
      .eq("id", p.id);
    if (closeError) return "skipped";
  }

  if (nextGradeName === null) {
    await supabase.from("students").update({ is_active: false }).eq("id", p.student_id);
    return "graduated";
  }
  if (!nextGradeName) return "skipped";

  const nextGradeId = args.toGradeByName.get(nextGradeName);
  if (!nextGradeId) return "skipped";

  const oldClassName = p.classes?.name ?? "";
  const nextClassName = mapPromotedClassName(gradeName, nextGradeName, oldClassName);
  const nextClass = await ensureClass(
    supabase,
    args.toYearId,
    nextGradeId,
    nextClassName,
    args.toClasses
  );
  if (!nextClass) return "skipped";

  const trackName = p.tracks?.name ?? args.fromTrackName.get(p.track_id) ?? "";
  const nextTrackId = await ensureNamedEntity(
    supabase,
    "tracks",
    args.toYearId,
    trackName,
    args.toTrackByName
  );
  if (!nextTrackId) return "skipped";

  const specName = p.specialization_id ? args.fromSpecName.get(p.specialization_id) : null;
  const secondaryName = p.secondary_specialization_id
    ? args.fromSpecName.get(p.secondary_specialization_id)
    : null;

  const nextSpecId = specName
    ? await ensureNamedEntity(
        supabase,
        "specializations",
        args.toYearId,
        specName,
        args.toSpecByName
      )
    : null;
  const nextSecondaryId = secondaryName
    ? await ensureNamedEntity(
        supabase,
        "specializations",
        args.toYearId,
        secondaryName,
        args.toSpecByName
      )
    : null;

  const { error } = await supabase.from("student_assignments").insert({
    student_id: p.student_id,
    academic_year_id: args.toYearId,
    grade_id: nextGradeId,
    class_id: nextClass.id,
    track_id: nextTrackId,
    specialization_id: nextSpecId,
    secondary_specialization_id: nextSecondaryId,
    is_psychology: Boolean(p.is_psychology),
    start_date: args.startDate,
    end_date: null,
  });

  return error ? "skipped" : "promoted";
}

/**
 * Promote open placements: א→ב, ב→ג, ג→ archive.
 * Always closes the old assignment before opening the new one (overlap trigger).
 */
export async function promoteStudentsToYear(
  fromYearId: string,
  toYearId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());
  await copyYearStructure(fromYearId, toYearId, supabase);

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
        "id, student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date, end_date, classes(name), tracks(name), students(id, is_active)"
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
  const ctx = {
    fromYearId,
    toYearId,
    fromGradeName,
    toGradeByName,
    toClasses,
    toTrackByName,
    fromTrackName,
    fromSpecName,
    toSpecByName,
    startDate,
    endDate,
  };

  for (const raw of placements ?? []) {
    const p = raw as unknown as PlacementRow;
    const result = await applyPromotionFromPlacement(supabase, p, ctx);
    if (result === "promoted") promoted++;
    else if (result === "graduated") graduated++;
    else skipped++;
  }

  return { promoted, graduated, skipped };
}

/**
 * Repair: for students missing a placement in the target year, recreate from the
 * previous year's latest placement (even if already closed by a failed promote).
 */
export async function repairMissingPromotions(
  toYearId: string,
  fromYearId?: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());

  let resolvedFromId = fromYearId ?? null;
  if (!resolvedFromId) {
    const { data: years } = await supabase
      .from("academic_years")
      .select("id, created_at")
      .order("created_at", { ascending: false });
    const idx = (years ?? []).findIndex((y) => y.id === toYearId);
    resolvedFromId =
      idx >= 0 ? (years?.[idx + 1]?.id ?? null) : (years?.[1]?.id ?? null);
  }

  if (!resolvedFromId) {
    return {
      promoted: 0,
      graduated: 0,
      skipped: 0,
      alreadyHad: 0,
      fromYearId: null as string | null,
      error: "לא נמצאה שנה קודמת לשחזור ממנה",
    };
  }

  await copyYearStructure(resolvedFromId, toYearId, supabase);

  const [
    { data: fromGrades },
    { data: toGrades },
    { data: toClassesRaw },
    { data: toTracks },
    { data: fromTracks },
    { data: fromSpecs },
    { data: toSpecs },
    { data: fromPlacements },
    { data: toPlacements },
  ] = await Promise.all([
    supabase.from("grades").select("id, name").eq("academic_year_id", resolvedFromId),
    supabase.from("grades").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("classes").select("id, name, grade_id").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("id, name").eq("academic_year_id", toYearId),
    supabase.from("tracks").select("id, name").eq("academic_year_id", resolvedFromId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", resolvedFromId),
    supabase.from("specializations").select("id, name").eq("academic_year_id", toYearId),
    supabase
      .from("student_assignments")
      .select(
        "id, student_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date, end_date, classes(name), tracks(name), students(id, is_active)"
      )
      .eq("academic_year_id", resolvedFromId),
    supabase.from("student_assignments").select("student_id").eq("academic_year_id", toYearId),
  ]);

  const already = new Set((toPlacements ?? []).map((r) => r.student_id));
  const candidates = pickLatestPlacementPerStudent(
    (fromPlacements ?? []) as unknown as PlacementRow[]
  ).filter((p) => !already.has(p.student_id));

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
  const ctx = {
    fromYearId: resolvedFromId,
    toYearId,
    fromGradeName,
    toGradeByName,
    toClasses,
    toTrackByName,
    fromTrackName,
    fromSpecName,
    toSpecByName,
    startDate,
    endDate,
  };

  for (const p of candidates) {
    const result = await applyPromotionFromPlacement(supabase, p, ctx);
    if (result === "promoted") promoted++;
    else if (result === "graduated") graduated++;
    else skipped++;
  }

  return {
    promoted,
    graduated,
    skipped,
    alreadyHad: already.size,
    fromYearId: resolvedFromId,
    error: null as string | null,
  };
}

