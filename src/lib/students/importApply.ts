import { addDays } from "@/lib/dates/hebrew";
import { refreshAutomaticLessonAssignmentsForStudent } from "@/lib/lessons/autoAssign";
import type { ParsedStudentImportRow, StudentImportParseError } from "@/lib/students/excelImport";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StudentImportApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: StudentImportParseError[];
}

type CurrentAssignment = {
  id: string;
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  start_date: string;
};

type StudentSnapshot = {
  full_name: string;
  first_name: string;
  last_name: string;
  mi: string | null;
  identity_number: string;
  cohort_number: number;
  is_active: boolean;
  chetz_program: boolean;
  birth_date: string | null;
  birth_date_hebrew: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  student_phone: string | null;
  high_school: string | null;
};

function samePlacement(current: CurrentAssignment, row: ParsedStudentImportRow): boolean {
  return (
    current.grade_id === row.gradeId &&
    current.class_id === row.classId &&
    current.track_id === row.trackId &&
    (current.specialization_id ?? null) === row.specializationId &&
    (current.secondary_specialization_id ?? null) === row.secondarySpecializationId &&
    Boolean(current.is_psychology) === row.isPsychology
  );
}

function placementPayload(row: ParsedStudentImportRow, yearId: string, studentId: string) {
  return {
    student_id: studentId,
    academic_year_id: yearId,
    grade_id: row.gradeId,
    class_id: row.classId,
    track_id: row.trackId,
    specialization_id: row.specializationId,
    secondary_specialization_id: row.secondarySpecializationId,
    is_psychology: row.isPsychology,
    start_date: row.startDate,
    end_date: null as string | null,
  };
}

async function refreshLessons(row: ParsedStudentImportRow, yearId: string, studentId: string) {
  await refreshAutomaticLessonAssignmentsForStudent(
    studentId,
    yearId,
    {
      grade_id: row.gradeId,
      class_id: row.classId,
      track_id: row.trackId,
      specialization_id: row.specializationId,
      secondary_specialization_id: row.secondarySpecializationId,
      is_psychology: row.isPsychology,
    },
    row.startDate
  );
}

function studentFields(row: ParsedStudentImportRow) {
  return {
    full_name: row.fullName,
    first_name: row.firstName,
    last_name: row.lastName,
    mi: row.mi,
    identity_number: row.identityNumber,
    cohort_number: row.cohortNumber,
    birth_date: row.birthDate,
    birth_date_hebrew: row.birthDateHebrew,
    address: row.address,
    city: row.city,
    phone: row.phone,
    father_phone: row.fatherPhone,
    mother_phone: row.motherPhone,
    student_phone: row.studentPhone,
    high_school: row.highSchool,
    chetz_program: row.chetzProgram,
    is_active: true,
  };
}

/** Import rollback only: drop students created in this run. Not a product delete. */
async function rollbackImport(
  supabase: SupabaseClient,
  createdStudentIds: string[],
  newAssignmentIds: string[],
  closedAssignmentIds: string[],
  snapshots: Array<{ id: string; fields: StudentSnapshot }>
) {
  if (newAssignmentIds.length > 0) {
    await supabase.from("student_assignments").delete().in("id", newAssignmentIds);
  }
  if (closedAssignmentIds.length > 0) {
    await supabase.from("student_assignments").update({ end_date: null }).in("id", closedAssignmentIds);
  }
  for (const snap of snapshots) {
    await supabase.from("students").update(snap.fields).eq("id", snap.id);
  }
  if (createdStudentIds.length > 0) {
    await supabase.from("students").delete().in("id", createdStudentIds);
  }
}

export async function applyStudentImportRows(
  supabase: SupabaseClient,
  yearId: string,
  rows: ParsedStudentImportRow[]
): Promise<StudentImportApplyResult> {
  const result: StudentImportApplyResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };
  const createdStudentIds: string[] = [];
  const newAssignmentIds: string[] = [];
  const closedAssignmentIds: string[] = [];
  const snapshots: Array<{ id: string; fields: StudentSnapshot }> = [];

  const fail = async (rowNumber: number, message: string): Promise<StudentImportApplyResult> => {
    await rollbackImport(
      supabase,
      createdStudentIds,
      newAssignmentIds,
      closedAssignmentIds,
      snapshots
    );
    return {
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [{ rowNumber, message: `${message} · הייבוא בוטל ולא נשמרה אף תלמידה` }],
    };
  };

  for (const row of rows) {
    try {
      const { data: existing, error: lookupError } = await supabase
        .from("students")
        .select(
          "id, full_name, first_name, last_name, cohort_number, is_active, chetz_program, mi, birth_date, birth_date_hebrew, address, city, phone, father_phone, mother_phone, student_phone, high_school, identity_number"
        )
        .eq("identity_number", row.identityNumber)
        .maybeSingle();
      if (lookupError) return fail(row.rowNumber, lookupError.message);

      const fields = studentFields(row);

      if (!existing) {
        const { data: created, error: insertError } = await supabase
          .from("students")
          .insert(fields)
          .select("id")
          .single();
        if (insertError || !created) {
          return fail(row.rowNumber, insertError?.message ?? "יצירת תלמידה נכשלה");
        }
        createdStudentIds.push(created.id);
        const { data: placed, error: placementError } = await supabase
          .from("student_assignments")
          .insert(placementPayload(row, yearId, created.id))
          .select("id")
          .single();
        if (placementError || !placed) {
          return fail(row.rowNumber, `השיבוץ נכשל: ${placementError?.message ?? "שגיאה"}`);
        }
        newAssignmentIds.push(placed.id);
        await refreshLessons(row, yearId, created.id);
        result.created += 1;
        continue;
      }

      snapshots.push({
        id: existing.id,
        fields: {
          full_name: existing.full_name,
          first_name: existing.first_name,
          last_name: existing.last_name,
          mi: existing.mi,
          identity_number: existing.identity_number,
          cohort_number: existing.cohort_number,
          is_active: existing.is_active,
          chetz_program: existing.chetz_program,
          birth_date: existing.birth_date,
          birth_date_hebrew: existing.birth_date_hebrew,
          address: existing.address,
          city: existing.city,
          phone: existing.phone,
          father_phone: existing.father_phone,
          mother_phone: existing.mother_phone,
          student_phone: existing.student_phone,
          high_school: existing.high_school,
        },
      });

      const { error: updateError } = await supabase.from("students").update(fields).eq("id", existing.id);
      if (updateError) return fail(row.rowNumber, updateError.message);

      const { data: current, error: assignmentError } = await supabase
        .from("student_assignments")
        .select(
          "id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date"
        )
        .eq("student_id", existing.id)
        .eq("academic_year_id", yearId)
        .is("end_date", null)
        .maybeSingle();
      if (assignmentError) return fail(row.rowNumber, assignmentError.message);

      if (!current) {
        const { data: placed, error: placementError } = await supabase
          .from("student_assignments")
          .insert(placementPayload(row, yearId, existing.id))
          .select("id")
          .single();
        if (placementError || !placed) {
          return fail(row.rowNumber, `השיבוץ נכשל: ${placementError?.message ?? "שגיאה"}`);
        }
        newAssignmentIds.push(placed.id);
        await refreshLessons(row, yearId, existing.id);
        result.updated += 1;
        continue;
      }

      if (samePlacement(current as CurrentAssignment, row)) {
        result.updated += 1;
        continue;
      }

      const endDate = addDays(row.startDate, -1);
      const { error: closeError } = await supabase
        .from("student_assignments")
        .update({ end_date: endDate })
        .eq("id", current.id);
      if (closeError) return fail(row.rowNumber, `לא ניתן לסגור שיבוץ קודם: ${closeError.message}`);
      closedAssignmentIds.push(current.id);

      const { data: opened, error: openError } = await supabase
        .from("student_assignments")
        .insert(placementPayload(row, yearId, existing.id))
        .select("id")
        .single();
      if (openError || !opened) {
        return fail(row.rowNumber, `פתיחת שיבוץ חדש נכשלה: ${openError?.message ?? "שגיאה"}`);
      }
      newAssignmentIds.push(opened.id);
      await refreshLessons(row, yearId, existing.id);
      result.updated += 1;
    } catch (error) {
      return fail(row.rowNumber, error instanceof Error ? error.message : "ייבוא השורה נכשל");
    }
  }

  return result;
}
