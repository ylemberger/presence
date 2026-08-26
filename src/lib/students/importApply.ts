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

  for (const row of rows) {
    try {
      const { data: existing, error: lookupError } = await supabase
        .from("students")
        .select(
          "id, full_name, first_name, last_name, cohort_number, is_active, chetz_program, mi, birth_date, birth_date_hebrew, address, city, phone, father_phone, mother_phone, student_phone, high_school"
        )
        .eq("identity_number", row.identityNumber)
        .maybeSingle();
      if (lookupError) {
        result.errors.push({ rowNumber: row.rowNumber, message: lookupError.message });
        continue;
      }

      let studentId = existing?.id;
      let studentChanged = false;

      const studentFields = {
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

      if (!studentId) {
        const { data: created, error: insertError } = await supabase
          .from("students")
          .insert(studentFields)
          .select("id")
          .single();
        if (insertError || !created) {
          result.errors.push({
            rowNumber: row.rowNumber,
            message: insertError?.message ?? "יצירת תלמידה נכשלה",
          });
          continue;
        }
        studentId = created.id;
        const { error: placementError } = await supabase
          .from("student_assignments")
          .insert(placementPayload(row, yearId, studentId));
        if (placementError) {
          await supabase.from("students").update({ is_active: false }).eq("id", studentId);
          result.errors.push({
            rowNumber: row.rowNumber,
            message: `התלמידה נוצרה אך השיבוץ נכשל: ${placementError.message}`,
          });
          continue;
        }
        await refreshLessons(row, yearId, studentId);
        result.created += 1;
        continue;
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from("students")
          .update(studentFields)
          .eq("id", studentId);
        if (updateError) {
          result.errors.push({ rowNumber: row.rowNumber, message: updateError.message });
          continue;
        }
        studentChanged = true;
      }

      const { data: current, error: assignmentError } = await supabase
        .from("student_assignments")
        .select(
          "id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, start_date"
        )
        .eq("student_id", studentId)
        .eq("academic_year_id", yearId)
        .is("end_date", null)
        .maybeSingle();
      if (assignmentError) {
        result.errors.push({ rowNumber: row.rowNumber, message: assignmentError.message });
        continue;
      }

      if (!current) {
        const { error: placementError } = await supabase
          .from("student_assignments")
          .insert(placementPayload(row, yearId, studentId));
        if (placementError) {
          result.errors.push({
            rowNumber: row.rowNumber,
            message: `עדכון פרטים נשמר אך השיבוץ נכשל: ${placementError.message}`,
          });
          continue;
        }
        await refreshLessons(row, yearId, studentId);
        result.updated += 1;
        continue;
      }

      if (samePlacement(current, row)) {
        if (studentChanged) result.updated += 1;
        else result.unchanged += 1;
        continue;
      }

      const endDate = addDays(row.startDate, -1);
      const { error: closeError } = await supabase
        .from("student_assignments")
        .update({ end_date: endDate })
        .eq("id", current.id);
      if (closeError) {
        result.errors.push({
          rowNumber: row.rowNumber,
          message: `לא ניתן לסגור שיבוץ קודם: ${closeError.message}`,
        });
        continue;
      }

      const { error: openError } = await supabase
        .from("student_assignments")
        .insert(placementPayload(row, yearId, studentId));
      if (openError) {
        await supabase
          .from("student_assignments")
          .update({ end_date: null })
          .eq("id", current.id);
        result.errors.push({
          rowNumber: row.rowNumber,
          message: `פתיחת שיבוץ חדש נכשלה: ${openError.message}`,
        });
        continue;
      }

      await refreshLessons(row, yearId, studentId);
      result.updated += 1;
    } catch (error) {
      result.errors.push({
        rowNumber: row.rowNumber,
        message: error instanceof Error ? error.message : "ייבוא השורה נכשל",
      });
    }
  }

  return result;
}
