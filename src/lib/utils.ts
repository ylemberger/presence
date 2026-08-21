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
