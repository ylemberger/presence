import type { SupabaseClient } from "@supabase/supabase-js";

function isMissingSubjectsTable(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /public\.subjects|schema cache|PGRST205|42P01/i.test(msg);
}

function missingSubjectsSqlError(): { error: string } {
  return {
    error:
      "חסרה טבלת מקצועות במסד. הריצי ב-Supabase את supabase/patches/014_subjects.sql ואז Settings → API → Reload schema.",
  };
}

export async function resolveOrCreateSubject(
  supabase: SupabaseClient,
  yearId: string,
  subjectIdRaw: string | null | undefined,
  newNameRaw: string | null | undefined
): Promise<{ id: string } | { error: string }> {
  const newName = (newNameRaw ?? "").trim();
  if (newName) {
    const { data: existing, error: lookupError } = await supabase
      .from("subjects")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("name", newName)
      .maybeSingle();
    if (isMissingSubjectsTable(lookupError)) return missingSubjectsSqlError();
    if (existing?.id) return { id: existing.id };

    const { data, error } = await supabase
      .from("subjects")
      .insert({ academic_year_id: yearId, name: newName })
      .select("id")
      .single();
    if (isMissingSubjectsTable(error)) return missingSubjectsSqlError();
    if (error || !data) {
      return { error: error?.message ?? "יצירת מקצוע נכשלה" };
    }
    return { id: data.id };
  }

  const subjectId = (subjectIdRaw ?? "").trim();
  if (!subjectId) {
    return { error: "יש לבחור מקצוע או להזין מקצוע חדש" };
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("academic_year_id", yearId)
    .maybeSingle();
  if (isMissingSubjectsTable(error)) return missingSubjectsSqlError();
  if (!data) return { error: "המקצוע שנבחר אינו תקין" };
  return { id: data.id };
}
