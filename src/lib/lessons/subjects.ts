import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveOrCreateSubject(
  supabase: SupabaseClient,
  yearId: string,
  subjectIdRaw: string | null | undefined,
  newNameRaw: string | null | undefined
): Promise<{ id: string } | { error: string }> {
  const newName = (newNameRaw ?? "").trim();
  if (newName) {
    const { data: existing } = await supabase
      .from("subjects")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("name", newName)
      .maybeSingle();
    if (existing?.id) return { id: existing.id };

    const { data, error } = await supabase
      .from("subjects")
      .insert({ academic_year_id: yearId, name: newName })
      .select("id")
      .single();
    if (error || !data) {
      return { error: error?.message ?? "יצירת מקצוע נכשלה" };
    }
    return { id: data.id };
  }

  const subjectId = (subjectIdRaw ?? "").trim();
  if (!subjectId) {
    return { error: "יש לבחור מקצוע או להזין מקצוע חדש" };
  }

  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("academic_year_id", yearId)
    .maybeSingle();
  if (!data) return { error: "המקצוע שנבחר אינו תקין" };
  return { id: data.id };
}
