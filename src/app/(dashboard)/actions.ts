"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setActiveAcademicYear } from "@/lib/utils";
import { syncTeacherSourceRecords } from "@/lib/sync/teachers";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import type { AttendanceStatus } from "@/types/database";

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days, 12, 0, 0);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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

async function countRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
  id: string
) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, id);
  return count ?? 0;
}

async function deleteEntityWithChecks(
  table:
    | "grades"
    | "classes"
    | "tracks"
    | "specializations"
    | "activity_ranges"
    | "attendance_rules",
  id: string,
  checks: Array<{ table: string; column: string }>,
  entityLabel: string
) {
  const supabase = await createClient();
  for (const check of checks) {
    const count = await countRefs(supabase, check.table, check.column, id);
    if (count > 0) return { error: `לא ניתן למחוק ${entityLabel} - קיימות הפניות` };
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteGradeAction(id: string) {
  return deleteEntityWithChecks(
    "grades",
    id,
    [
      { table: "student_assignments", column: "grade_id" },
      { table: "classes", column: "grade_id" },
      { table: "lessons", column: "grade_id" },
    ],
    "שכבה"
  );
}

export async function deleteClassAction(id: string) {
  return deleteEntityWithChecks(
    "classes",
    id,
    [
      { table: "student_assignments", column: "class_id" },
      { table: "lessons", column: "class_id" },
      { table: "teacher_teaching_assignments", column: "class_id" },
    ],
    "כיתה"
  );
}

export async function deleteTrackAction(id: string) {
  return deleteEntityWithChecks(
    "tracks",
    id,
    [
      { table: "student_assignments", column: "track_id" },
      { table: "lessons", column: "track_id" },
    ],
    "מגמה"
  );
}

export async function deleteSpecializationAction(id: string) {
  return deleteEntityWithChecks(
    "specializations",
    id,
    [
      { table: "student_assignments", column: "specialization_id" },
      { table: "lessons", column: "specialization_id" },
      { table: "teacher_teaching_assignments", column: "specialization_id" },
    ],
    "התמחות"
  );
}

export async function deleteActivityRangeAction(id: string) {
  return deleteEntityWithChecks(
    "activity_ranges",
    id,
    [{ table: "lessons", column: "activity_range_id" }],
    "טווח פעילות"
  );
}

export async function deleteAttendanceRuleAction(id: string) {
  return deleteEntityWithChecks(
    "attendance_rules",
    id,
    [{ table: "lessons", column: "attendance_rule_id" }],
    "כלל נוכחות"
  );
}

export async function updateAcademicYearAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const isActive = formData.get("is_active") === "on";
  if (isActive) {
    await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  }
  const { error } = await supabase
    .from("academic_years")
    .update({ name: formData.get("name") as string, is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateGradeAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("grades")
    .update({ name: formData.get("name") as string })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateClassAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: formData.get("name") as string,
      grade_id: formData.get("grade_id") as string,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateTrackAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ name: formData.get("name") as string })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateSpecializationAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("specializations")
    .update({ name: formData.get("name") as string })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateActivityRangeAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("activity_ranges")
    .update({
      name: formData.get("name") as string,
      range_type: formData.get("range_type") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateAttendanceRuleAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_rules")
    .update({
      name: formData.get("name") as string,
      max_allowed_absence_percent: parseFloat(
        formData.get("max_allowed_absence_percent") as string
      ),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
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

export async function createStudentLessonAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const studentId = formData.get("student_id") as string;
  const { error } = await supabase.from("student_lesson_assignments").insert({
    student_id: studentId,
    lesson_id: formData.get("lesson_id") as string,
    assignment_type: (formData.get("assignment_type") as string) || "manual",
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { success: true };
}

export async function deleteStudentLessonAssignmentAction(id: string, studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_lesson_assignments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/students/${studentId}`);
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
    const endDate = addDaysLocal(transferDate, -1);

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

export async function createLessonForDateAction(formData: FormData) {
  const supabase = await createClient();
  const occurrenceDate = formData.get("occurrence_date") as string;
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
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
    })
    .select("id")
    .single();

  if (error || !lesson) return { error: error?.message ?? "יצירת שיעור נכשלה" };

  const { error: occError } = await supabase.from("lesson_occurrences").insert({
    lesson_id: lesson.id,
    occurrence_date: occurrenceDate,
    status: "scheduled",
  });
  if (occError) return { error: occError.message };

  revalidatePath("/lessons");
  revalidatePath("/attendance");
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

export async function completeOccurrenceAction(occurrenceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "completed" })
    .eq("id", occurrenceId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  return { success: true };
}

export async function restoreOccurrenceAction(occurrenceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "scheduled" })
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
