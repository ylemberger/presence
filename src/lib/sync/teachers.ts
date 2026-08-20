import { createClient } from "@/lib/supabase/server";
import type { TeacherSourceRecord } from "@/types/database";

export interface SyncResult {
  teachersCreated: number;
  teachersUpdated: number;
  assignmentsCreated: number;
  skipped: number;
}

export async function syncTeacherSourceRecords(
  academicYearId: string,
  sourceYear?: string
): Promise<SyncResult> {
  const supabase = await createClient();
  const result: SyncResult = {
    teachersCreated: 0,
    teachersUpdated: 0,
    assignmentsCreated: 0,
    skipped: 0,
  };

  let query = supabase.from("teacher_source_records").select("*");
  if (sourceYear) {
    query = query.eq("source_year", sourceYear);
  }
  const { data: sourceRecords, error } = await query;
  if (error) throw error;
  if (!sourceRecords?.length) return result;

  for (const record of sourceRecords as TeacherSourceRecord[]) {
    const { data: existingTeacher } = await supabase
      .from("teachers")
      .select("*")
      .eq("identity_number", record.teacher_identity_number)
      .maybeSingle();

    let teacherId: string;

    if (!existingTeacher) {
      const { data: newTeacher, error: createError } = await supabase
        .from("teachers")
        .insert({
          full_name: record.full_name,
          identity_number: record.teacher_identity_number,
          phone: "0500000000",
          email: `${record.teacher_identity_number}@sync.local`,
          is_local: false,
        })
        .select()
        .single();
      if (createError) throw createError;
      teacherId = newTeacher.id;
      result.teachersCreated++;
    } else {
      teacherId = existingTeacher.id;
      if (!existingTeacher.is_local) {
        const updates: Record<string, string> = {};
        if (!existingTeacher.full_name) updates.full_name = record.full_name;
        if (Object.keys(updates).length > 0) {
          await supabase.from("teachers").update(updates).eq("id", teacherId);
          result.teachersUpdated++;
        }
      } else {
        result.skipped++;
      }
    }

    const { data: existingAssignment } = await supabase
      .from("teacher_teaching_assignments")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("academic_year_id", academicYearId)
      .eq("subject", record.subject)
      .maybeSingle();

    if (!existingAssignment) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("academic_year_id", academicYearId)
        .limit(1);

      if (classes?.length) {
        await supabase.from("teacher_teaching_assignments").insert({
          teacher_id: teacherId,
          academic_year_id: academicYearId,
          subject: record.subject,
          class_id: classes[0].id,
          source_record_id: record.id,
        });
        result.assignmentsCreated++;
      }
    }
  }

  return result;
}
