import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns that may be missing on older presence DBs — try richest first. */
const SOURCE_SELECTS = [
  "teacher_id, teacher_identity_number, subject, payload, salary_subject, salary_track, salary_grade_year, salary_semester, salary_meetings",
  "teacher_id, teacher_identity_number, subject, payload",
  "teacher_identity_number, subject, payload",
] as const;

export type TeacherSourceRow = {
  teacher_id?: string | null;
  teacher_identity_number?: string | null;
  subject?: string | null;
  payload?: unknown;
  salary_subject?: string | null;
  salary_track?: string | null;
  salary_grade_year?: string | null;
  salary_semester?: string | null;
  salary_meetings?: number | null;
};

export async function fetchTeacherSourceRecords(
  supabase: SupabaseClient
): Promise<TeacherSourceRow[]> {
  for (const select of SOURCE_SELECTS) {
    const { data, error } = await supabase.from("teacher_source_records").select(select);
    if (!error) return (data ?? []) as TeacherSourceRow[];
  }
  return [];
}

export function groupSourceRowsByTeacher(
  rows: TeacherSourceRow[],
  identityToTeacherId: Map<string, string>
): Map<string, TeacherSourceRow[]> {
  const byTeacher = new Map<string, TeacherSourceRow[]>();
  for (const row of rows) {
    const teacherId =
      row.teacher_id ||
      (row.teacher_identity_number
        ? identityToTeacherId.get(row.teacher_identity_number)
        : undefined);
    if (!teacherId) continue;
    const list = byTeacher.get(teacherId) ?? [];
    list.push(row);
    byTeacher.set(teacherId, list);
  }
  return byTeacher;
}
