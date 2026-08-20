import { createClient } from "@/lib/supabase/server";
import type { AcademicYear } from "@/types/database";

export async function getActiveAcademicYear(): Promise<AcademicYear | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getAllAcademicYears(): Promise<AcademicYear[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function setActiveAcademicYear(yearId: string) {
  const supabase = await createClient();
  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabase
    .from("academic_years")
    .update({ is_active: true })
    .eq("id", yearId);
  if (error) throw error;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("he-IL");
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string | null
): boolean {
  return date >= startDate && (endDate === null || date <= endDate);
}
