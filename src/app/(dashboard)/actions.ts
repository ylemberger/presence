"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setActiveAcademicYear } from "@/lib/utils";
import { syncTeacherSourceRecords } from "@/lib/sync/teachers";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import type { AttendanceStatus } from "@/types/database";

export async function setActiveYearAction(yearId: string) {
  await setActiveAcademicYear(yearId);
  revalidatePath("/", "layout");
}

// --- Academic Years ---
export async function createAcademicYearAction(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const isActive = formData.get("is_active") === "on";

  if (isActive) {
    await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  }

  const { error } = await supabase.from("academic_years").insert({ name, is_active: isActive });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAcademicYearAction(id: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("student_assignments")
    .select("*", { count: "exact", head: true })
    .eq("academic_year_id", id);
  if (count && count > 0) return { error: "לא ניתן למחוק שנה עם שיבוצי תלמידות" };

  const { error } = await supabase.from("academic_years").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

// --- Generic year-scoped entity CRUD helpers ---
async function createYearEntity(
  table: "grades" | "classes" | "tracks" | "specializations" | "activity_ranges",
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(data);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function createGradeAction(formData: FormData) {
  return createYearEntity("grades", {
    academic_year_id: formData.get("academic_year_id"),
    name: formData.get("name"),
  });
}

export async function createClassAction(formData: FormData) {
  return createYearEntity("classes", {
    academic_year_id: formData.get("academic_year_id"),
    grade_id: formData.get("grade_id"),
    name: formData.get("name"),
  });
}

export async function createTrackAction(formData: FormData) {
  return createYearEntity("tracks", {
    academic_year_id: formData.get("academic_year_id"),
    name: formData.get("name"),
  });
}

export async function createSpecializationAction(formData: FormData) {
  return createYearEntity("specializations", {
    academic_year_id: formData.get("academic_year_id"),
    name: formData.get("name"),
  });
}

export async function createActivityRangeAction(formData: FormData) {
  return createYearEntity("activity_ranges", {
    academic_year_id: formData.get("academic_year_id"),
    name: formData.get("name"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    range_type: formData.get("range_type"),
  });
}

export async function createAttendanceRuleAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_rules").insert({
    name: formData.get("name") as string,
    max_allowed_absence_percent: parseFloat(formData.get("max_allowed_absence_percent") as string),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

async function deleteEntityWithCheck(
  table:
    | "grades"
    | "classes"
    | "tracks"
    | "specializations"
    | "activity_ranges"
    | "attendance_rules",
  id: string,
  checkTable:
    | "student_assignments"
    | "lessons",
  checkColumn: string,
  entityLabel: string
) {
  const supabase = await createClient();
  const { count } = await supabase
    .from(checkTable)
    .select("*", { count: "exact", head: true })
    .eq(checkColumn, id);
  if (count && count > 0) return { error: `לא ניתן למחוק ${entityLabel} - קיימות הפניות` };

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteGradeAction(id: string) {
  return deleteEntityWithCheck("grades", id, "student_assignments", "grade_id", "שכבה");
}

export async function deleteClassAction(id: string) {
  return deleteEntityWithCheck("classes", id, "student_assignments", "class_id", "כיתה");
}

export async function deleteTrackAction(id: string) {
  return deleteEntityWithCheck("tracks", id, "student_assignments", "track_id", "מגמה");
}

export async function deleteSpecializationAction(id: string) {
  return deleteEntityWithCheck("specializations", id, "student_assignments", "specialization_id", "התמחות");
}

export async function deleteActivityRangeAction(id: string) {
  return deleteEntityWithCheck("activity_ranges", id, "lessons", "activity_range_id", "טווח פעילות");
}

export async function deleteAttendanceRuleAction(id: string) {
  return deleteEntityWithCheck("attendance_rules", id, "lessons", "attendance_rule_id", "כלל נוכחות");
}

// --- Students ---
export async function createStudentAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    full_name: formData.get("full_name") as string,
    identity_number: formData.get("identity_number") as string,
  });
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { success: true };
}

export async function updateStudentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      full_name: formData.get("full_name") as string,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: true };
}

export async function createStudentAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const specId = formData.get("specialization_id") as string;
  const { error } = await supabase.from("student_assignments").insert({
    student_id: formData.get("student_id") as string,
    academic_year_id: formData.get("academic_year_id") as string,
    grade_id: formData.get("grade_id") as string,
    class_id: formData.get("class_id") as string,
    track_id: formData.get("track_id") as string,
    specialization_id: specId || null,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/students/${formData.get("student_id")}`);
  return { success: true };
}

export async function transferStudentAction(formData: FormData) {
  const supabase = await createClient();
  const studentId = formData.get("student_id") as string;
  const transferDate = formData.get("transfer_date") as string;

  const { data: currentAssignment } = await supabase
    .from("student_assignments")
    .select("*")
    .eq("student_id", studentId)
    .is("end_date", null)
    .maybeSingle();

  if (currentAssignment) {
    const dayBefore = new Date(transferDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const endDate = dayBefore.toISOString().split("T")[0];

    const { error: closeError } = await supabase
      .from("student_assignments")
      .update({ end_date: endDate })
      .eq("id", currentAssignment.id);
    if (closeError) return { error: closeError.message };
  }

  const specId = formData.get("specialization_id") as string;
  const { error } = await supabase.from("student_assignments").insert({
    student_id: studentId,
    academic_year_id: formData.get("academic_year_id") as string,
    grade_id: formData.get("grade_id") as string,
    class_id: formData.get("class_id") as string,
    track_id: formData.get("track_id") as string,
    specialization_id: specId || null,
    start_date: transferDate,
    end_date: null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { success: true };
}

// --- Teachers ---
export async function createTeacherAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("teachers").insert({
    full_name: formData.get("full_name") as string,
    identity_number: formData.get("identity_number") as string,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    is_local: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { success: true };
}

export async function createSourceRecordAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("teacher_source_records").insert({
    external_id: formData.get("external_id") as string,
    teacher_identity_number: formData.get("teacher_identity_number") as string,
    full_name: formData.get("full_name") as string,
    subject: formData.get("subject") as string,
    source_year: formData.get("source_year") as string,
  });
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { success: true };
}

export async function syncTeachersAction(academicYearId: string) {
  try {
    const result = await syncTeacherSourceRecords(academicYearId);
    revalidatePath("/teachers");
    return { success: true, result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createTeachingAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const specId = formData.get("specialization_id") as string;
  const { error } = await supabase.from("teacher_teaching_assignments").insert({
    teacher_id: formData.get("teacher_id") as string,
    academic_year_id: formData.get("academic_year_id") as string,
    subject: formData.get("subject") as string,
    class_id: formData.get("class_id") as string,
    specialization_id: specId || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { success: true };
}

// --- Lessons ---
export async function createLessonAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").insert({
    academic_year_id: formData.get("academic_year_id") as string,
    teacher_teaching_assignment_id: formData.get("teacher_teaching_assignment_id") as string,
    subject: formData.get("subject") as string,
    grade_id: formData.get("grade_id") as string,
    class_id: (formData.get("class_id") as string) || null,
    track_id: (formData.get("track_id") as string) || null,
    specialization_id: (formData.get("specialization_id") as string) || null,
    billing_type: formData.get("billing_type") as "mandatory" | "specialization",
    day_of_week: parseInt(formData.get("day_of_week") as string),
    lesson_number: parseInt(formData.get("lesson_number") as string),
    activity_range_id: formData.get("activity_range_id") as string,
    attendance_rule_id: (formData.get("attendance_rule_id") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  return { success: true };
}

export async function generateOccurrencesAction(academicYearId: string) {
  try {
    const result = await generateLessonOccurrences(undefined, academicYearId);
    revalidatePath("/lessons");
    return { success: true, result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelOccurrenceAction(occurrenceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "cancelled" })
    .eq("id", occurrenceId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  return { success: true };
}

// --- Attendance ---
export async function upsertAttendanceAction(
  studentId: string,
  occurrenceId: string,
  status: AttendanceStatus
) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(
    { student_id: studentId, lesson_occurrence_id: occurrenceId, status },
    { onConflict: "student_id,lesson_occurrence_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return { success: true };
}

export async function bulkAttendanceAction(
  updates: { studentId: string; occurrenceId: string; status: AttendanceStatus }[]
) {
  const supabase = await createClient();
  const records = updates.map((u) => ({
    student_id: u.studentId,
    lesson_occurrence_id: u.occurrenceId,
    status: u.status,
  }));
  const { error } = await supabase
    .from("attendance")
    .upsert(records, { onConflict: "student_id,lesson_occurrence_id" });
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return { success: true };
}
