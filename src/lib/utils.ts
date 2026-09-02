import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AcademicYear } from "@/types/database";

/** Deduped per request — layout + page often both need the active year. */
export const getActiveAcademicYear = cache(async (): Promise<AcademicYear | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .maybeSingle();
  return data;
});

export const getAllAcademicYears = cache(async (): Promise<AcademicYear[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export async function setActiveAcademicYear(yearId: string) {
  const supabase = await createClient();
  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabase
    .from("academic_years")
    .update({ is_active: true })
    .eq("id", yearId);
  if (error) throw error;
}

/** Static year catalog — deduped per request across attendance/reports/dashboard. */
export const getYearCatalog = cache(async (academicYearId: string) => {
  const supabase = await createClient();
  const [classes, tracks, specializations, teachers, rules, grades] = await Promise.all([
    supabase.from("classes").select("id, name").eq("academic_year_id", academicYearId).order("name"),
    supabase.from("tracks").select("id, name").eq("academic_year_id", academicYearId).order("name"),
    supabase
      .from("specializations")
      .select("id, name")
      .eq("academic_year_id", academicYearId)
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    supabase
      .from("attendance_rules")
      .select("id, name, max_allowed_absence_percent")
      .order("name"),
    supabase.from("grades").select("id, name").eq("academic_year_id", academicYearId).order("name"),
  ]);

  return {
    classes: classes.data ?? [],
    tracks: tracks.data ?? [],
    specializations: specializations.data ?? [],
    teachers: (teachers.data ?? []).map((t) => ({ id: t.id, name: t.full_name })),
    rules: rules.data ?? [],
    grades: grades.data ?? [],
  };
});
