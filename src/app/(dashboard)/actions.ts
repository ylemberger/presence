"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setActiveAcademicYear } from "@/lib/utils";
import { syncTeacherSourceRecords } from "@/lib/sync/teachers";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import {
  autoAssignStudentsToLesson,
  lessonMismatchMessage,
  refreshAutomaticLessonAssignmentsForStudent,
} from "@/lib/lessons/autoAssign";
import {
  ensureFixedGrades,
  promoteStudentsToYear,
} from "@/lib/years/promote";
import { FIXED_GRADE_NAMES } from "@/lib/years/grades";
import type { AttendanceStatus } from "@/types/database";
import {
  isError,
  parseLessonBilling,
  requireId,
  requireText,
  validateEmail,
  validateIsraeliId,
  validatePhone,
} from "@/lib/validation";

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
  const shouldPromote = formData.get("promote_students") === "on";

  const { data: previousActive } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (isActive) {
    await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  }

  const { data: created, error } = await supabase
    .from("academic_years")
    .insert({ name, is_active: isActive })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "יצירת שנה נכשלה" };

  await ensureFixedGrades(created.id);

  let promoteResult = null;
  if (shouldPromote && previousActive?.id) {
    promoteResult = await promoteStudentsToYear(previousActive.id, created.id);
  }

  revalidatePath("/settings");
  revalidatePath("/students");
  return { success: true, promoteResult };
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
  table:
    | "grades"
    | "classes"
    | "tracks"
    | "specializations"
    | "activity_ranges",
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(data);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function createGradeAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!(FIXED_GRADE_NAMES as readonly string[]).includes(name)) {
    return { error: "שכבה חייבת להיות א, ב או ג בלבד" };
  }
  return createYearEntity("grades", {
    academic_year_id: formData.get("academic_year_id"),
    name,
  });
}

export async function createClassAction(formData: FormData) {
  const gradeId = String(formData.get("grade_id") ?? "").trim();
  if (!gradeId) return { error: "יש לבחור שכבה (א / ב / ג)" };

  const supabase = await createClient();
  const { data: grade } = await supabase
    .from("grades")
    .select("name")
    .eq("id", gradeId)
    .maybeSingle();
  if (!grade || !(FIXED_GRADE_NAMES as readonly string[]).includes(grade.name)) {
    return { error: "שכבה חייבת להיות א, ב או ג בלבד" };
  }

  return createYearEntity("classes", {
    academic_year_id: formData.get("academic_year_id"),
    grade_id: gradeId,
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
      { table: "teacher_teaching_assignments", column: "grade_id" },
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
      { table: "teacher_teaching_assignments", column: "track_id" },
    ],
    "מסלול"
  );
}

export async function deleteSpecializationAction(id: string) {
  return deleteEntityWithChecks(
    "specializations",
    id,
    [
      { table: "student_assignments", column: "specialization_id" },
      { table: "student_assignments", column: "secondary_specialization_id" },
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
  const name = String(formData.get("name") ?? "").trim();
  if (!(FIXED_GRADE_NAMES as readonly string[]).includes(name)) {
    return { error: "שכבה חייבת להיות א, ב או ג בלבד" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("grades").update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateClassAction(id: string, formData: FormData) {
  const gradeId = String(formData.get("grade_id") ?? "").trim();
  if (!gradeId) return { error: "יש לבחור שכבה (א / ב / ג)" };

  const supabase = await createClient();
  const { data: grade } = await supabase
    .from("grades")
    .select("name")
    .eq("id", gradeId)
    .maybeSingle();
  if (!grade || !(FIXED_GRADE_NAMES as readonly string[]).includes(grade.name)) {
    return { error: "שכבה חייבת להיות א, ב או ג בלבד" };
  }

  const { error } = await supabase
    .from("classes")
    .update({
      name: formData.get("name") as string,
      grade_id: gradeId,
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
  const fullName = requireText(formData.get("full_name"), "שם מלא");
  if (isError(fullName)) return fullName;
  const identity = validateIsraeliId(String(formData.get("identity_number") ?? ""));
  if (isError(identity)) return identity;

  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const gradeId = requireId(formData.get("grade_id"), "שכבה");
  if (isError(gradeId)) return gradeId;
  const classId = requireId(formData.get("class_id"), "כיתה");
  if (isError(classId)) return classId;
  const trackId = requireId(formData.get("track_id"), "מסלול");
  if (isError(trackId)) return trackId;
  const startDate = requireText(formData.get("start_date"), "בתוקף מתאריך");
  if (isError(startDate)) return startDate;
  const cohortRaw = String(formData.get("cohort_number") ?? "").trim();
  const cohortNumber = parseInt(cohortRaw, 10);
  if (!cohortRaw || Number.isNaN(cohortNumber) || cohortNumber < 1) {
    return { error: "יש להזין מספר מחזור תקין (1 ומעלה)" };
  }
  const specId = String(formData.get("specialization_id") ?? "").trim() || null;
  const secondarySpecId =
    String(formData.get("secondary_specialization_id") ?? "").trim() || null;
  const isPsychology =
    formData.get("is_psychology") === "on" || formData.get("is_psychology") === "1";

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("students")
    .insert({
      full_name: fullName,
      identity_number: identity,
      cohort_number: cohortNumber,
    })
    .select("id")
    .single();
  if (error || !student) {
    if (error?.code === "23505") return { error: 'מספר תעודת זהות כבר קיים במערכת' };
    return { error: error?.message ?? "יצירת תלמידה נכשלה" };
  }

  const { error: placementError } = await supabase.from("student_assignments").insert({
    student_id: student.id,
    academic_year_id: yearId,
    grade_id: gradeId,
    class_id: classId,
    track_id: trackId,
    specialization_id: specId,
    secondary_specialization_id: secondarySpecId,
    is_psychology: isPsychology,
    start_date: startDate,
    end_date: null,
  });
  if (placementError) {
    await supabase.from("students").update({ is_active: false }).eq("id", student.id);
    return { error: `התלמידה נוצרה אך השיבוץ נכשל: ${placementError.message}` };
  }

  await refreshAutomaticLessonAssignmentsForStudent(
    student.id,
    yearId,
    {
      grade_id: gradeId,
      class_id: classId,
      track_id: trackId,
      specialization_id: specId,
      secondary_specialization_id: secondarySpecId,
      is_psychology: isPsychology,
    },
    startDate
  );

  revalidatePath("/students");
  revalidatePath(`/students/${student.id}`);
  return { success: true };
}

export async function updateStudentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const cohortRaw = String(formData.get("cohort_number") ?? "").trim();
  const cohortNumber = parseInt(cohortRaw, 10);
  const patch: { full_name: string; is_active: boolean; cohort_number?: number } = {
    full_name: formData.get("full_name") as string,
    is_active: formData.get("is_active") === "on",
  };
  if (cohortRaw && !Number.isNaN(cohortNumber) && cohortNumber >= 1) {
    patch.cohort_number = cohortNumber;
  }
  const { error } = await supabase.from("students").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: true };
}

export async function createStudentLessonAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const studentId = requireId(formData.get("student_id"), "תלמידה");
  if (isError(studentId)) return studentId;
  const lessonId = requireId(formData.get("lesson_id"), "שיעור");
  if (isError(lessonId)) return lessonId;
  const startDate = requireText(formData.get("start_date"), "מתאריך");
  if (isError(startDate)) return startDate;
  const force = formData.get("force_mismatch") === "1";

  const [{ data: lesson }, { data: placement }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, class_id, track_id, specialization_id, billing_type, grade_id, subject, for_psychology"
      )
      .eq("id", lessonId)
      .single(),
    supabase
      .from("student_assignments")
      .select(
        "class_id, track_id, specialization_id, secondary_specialization_id, grade_id, is_psychology"
      )
      .eq("student_id", studentId)
      .is("end_date", null)
      .maybeSingle(),
  ]);

  if (!lesson) return { error: "השיעור לא נמצא" };
  if (!placement) return { error: "לתלמידה אין שיבוץ פעיל בשנה הנוכחית" };

  const mismatch = lessonMismatchMessage(placement, lesson);
  if (mismatch && !force) {
    return { error: mismatch, code: "mismatch" as const };
  }

  const { error } = await supabase.from("student_lesson_assignments").insert({
    student_id: studentId,
    lesson_id: lessonId,
    assignment_type: "manual",
    start_date: startDate,
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

function parsePlacementFields(formData: FormData) {
  const studentId = requireId(formData.get("student_id"), "תלמידה");
  if (isError(studentId)) return studentId;
  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const gradeId = requireId(formData.get("grade_id"), "שכבה");
  if (isError(gradeId)) return gradeId;
  const classId = requireId(formData.get("class_id"), "כיתה");
  if (isError(classId)) return classId;
  const trackId = requireId(formData.get("track_id"), "מסלול");
  if (isError(trackId)) return trackId;
  const startDate = requireText(
    formData.get("start_date") ?? formData.get("transfer_date"),
    "בתוקף מתאריך"
  );
  if (isError(startDate)) return startDate;
  const specId = String(formData.get("specialization_id") ?? "").trim() || null;
  const secondarySpecId =
    String(formData.get("secondary_specialization_id") ?? "").trim() || null;
  const isPsychology =
    formData.get("is_psychology") === "on" || formData.get("is_psychology") === "1";
  return {
    student_id: studentId,
    academic_year_id: yearId,
    grade_id: gradeId,
    class_id: classId,
    track_id: trackId,
    specialization_id: specId,
    secondary_specialization_id: secondarySpecId,
    is_psychology: isPsychology,
    start_date: startDate,
  };
}

export async function createStudentAssignmentAction(_formData: FormData) {
  return { error: "אין יצירת שיבוץ נפרד. בעת יצירת תלמידה ממלאים את כל הפרטים, ושינוי נעשה רק בהעברה." };
}

export async function transferStudentAction(formData: FormData) {
  const placement = parsePlacementFields(formData);
  if ("error" in placement) return placement;

  const supabase = await createClient();
  const { data: currentAssignment } = await supabase
    .from("student_assignments")
    .select("*")
    .eq("student_id", placement.student_id)
    .is("end_date", null)
    .maybeSingle();

  if (currentAssignment) {
    const endDate = addDaysLocal(placement.start_date, -1);
    const { error: closeError } = await supabase
      .from("student_assignments")
      .update({ end_date: endDate })
      .eq("id", currentAssignment.id);
    if (closeError) return { error: closeError.message };
  }

  const { error } = await supabase.from("student_assignments").insert({
    ...placement,
    end_date: null,
  });
  if (error) return { error: error.message };

  await refreshAutomaticLessonAssignmentsForStudent(
    placement.student_id,
    placement.academic_year_id,
    {
      grade_id: placement.grade_id,
      class_id: placement.class_id,
      track_id: placement.track_id,
      specialization_id: placement.specialization_id,
      secondary_specialization_id: placement.secondary_specialization_id,
      is_psychology: placement.is_psychology,
    },
    placement.start_date
  );

  revalidatePath(`/students/${placement.student_id}`);
  revalidatePath("/attendance");
  return { success: true };
}

// --- Teachers ---
export async function createTeacherAction(formData: FormData) {
  const fullName = requireText(formData.get("full_name"), "שם מלא");
  if (isError(fullName)) return fullName;
  const identity = validateIsraeliId(String(formData.get("identity_number") ?? ""));
  if (isError(identity)) return identity;
  const phone = validatePhone(String(formData.get("phone") ?? ""));
  if (isError(phone)) return phone;
  const email = validateEmail(String(formData.get("email") ?? ""));
  if (isError(email)) return email;

  const supabase = await createClient();
  const { error } = await supabase.from("teachers").insert({
    full_name: fullName,
    identity_number: identity,
    phone,
    email,
    is_local: true,
  });
  if (error) {
    if (error.code === "23505") return { error: 'מספר תעודת זהות כבר קיים במערכת' };
    return { error: error.message };
  }
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

async function insertTeachingAssignmentFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
) {
  const teacherId = requireId(formData.get("teacher_id"), "מורה");
  if (isError(teacherId)) return teacherId;
  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const subject = requireText(formData.get("subject"), "מקצוע");
  if (isError(subject)) return subject;
  const gradeId = requireId(formData.get("grade_id"), "שכבה");
  if (isError(gradeId)) return gradeId;
  const billing = parseLessonBilling(formData);
  if ("error" in billing) return billing;

  if (billing.class_id) {
    const { data: cls } = await supabase
      .from("classes")
      .select("id, grade_id")
      .eq("id", billing.class_id)
      .maybeSingle();
    if (!cls) return { error: "הכיתה שנבחרה אינה תקינה" };
    if (cls.grade_id !== gradeId) {
      return { error: "הכיתה חייבת להיות מתוך השכבה שנבחרה" };
    }
  }

  const { data: assignment, error } = await supabase
    .from("teacher_teaching_assignments")
    .insert({
      teacher_id: teacherId,
      academic_year_id: yearId,
      subject,
      billing_type: billing.billing_type,
      grade_id: gradeId,
      class_id: billing.class_id,
      track_id: billing.track_id,
      specialization_id: billing.specialization_id,
      for_psychology: billing.for_psychology,
    })
    .select(
      "id, subject, billing_type, grade_id, class_id, track_id, specialization_id, for_psychology"
    )
    .single();

  if (error || !assignment) {
    return { error: error?.message ?? "יצירת שיבוץ הוראה נכשלה" };
  }

  return assignment;
}

export async function createTeachingAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const result = await insertTeachingAssignmentFromForm(supabase, formData);
  if ("error" in result) return result;
  revalidatePath("/teachers");
  revalidatePath("/lessons");
  return { success: true };
}

async function buildLessonPayload(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const rangeId = requireId(formData.get("activity_range_id"), "טווח פעילות");
  if (isError(rangeId)) return rangeId;
  const ruleId = requireId(formData.get("attendance_rule_id"), "כלל נוכחות");
  if (isError(ruleId)) return ruleId;

  const dayOfWeek = parseInt(String(formData.get("day_of_week") ?? ""), 10);
  if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "יש לבחור יום בשבוע" };
  }
  const lessonNumber = parseInt(String(formData.get("lesson_number") ?? ""), 10);
  if (Number.isNaN(lessonNumber) || lessonNumber < 1 || lessonNumber > 9) {
    return { error: "מספר שיעור חייב להיות בין 1 ל-9" };
  }

  const supabase = await createClient();
  let teachingId = String(formData.get("teacher_teaching_assignment_id") ?? "").trim();
  let teaching: {
    subject: string;
    billing_type: string;
    grade_id: string | null;
    class_id: string | null;
    track_id: string | null;
    specialization_id: string | null;
    for_psychology: boolean;
  };

  if (teachingId) {
    const { data, error: teachingError } = await supabase
      .from("teacher_teaching_assignments")
      .select(
        "subject, billing_type, grade_id, class_id, track_id, specialization_id, for_psychology"
      )
      .eq("id", teachingId)
      .single();
    if (teachingError || !data) {
      return { error: "שיבוץ ההוראה שנבחר אינו תקין" };
    }
    teaching = data;
  } else {
    const created = await insertTeachingAssignmentFromForm(supabase, formData);
    if ("error" in created) return created;
    teachingId = created.id;
    teaching = created;
  }

  if (!teaching.billing_type) {
    return { error: "חסר סוג שיעור (חובה/התמחות)" };
  }

  let gradeId = teaching.grade_id as string | null;
  if (!gradeId && teaching.class_id) {
    const { data: cls } = await supabase
      .from("classes")
      .select("grade_id")
      .eq("id", teaching.class_id)
      .maybeSingle();
    gradeId = cls?.grade_id ?? null;
  }
  if (!gradeId) {
    return { error: "חסרה שכבה לשיעור" };
  }

  return {
    academic_year_id: yearId,
    teacher_teaching_assignment_id: teachingId,
    subject: teaching.subject,
    grade_id: gradeId,
    class_id: teaching.class_id,
    track_id: teaching.track_id,
    specialization_id: teaching.specialization_id,
    billing_type: teaching.billing_type as "mandatory" | "specialization",
    for_psychology: Boolean(teaching.for_psychology),
    day_of_week: dayOfWeek,
    lesson_number: lessonNumber,
    activity_range_id: rangeId,
    attendance_rule_id: ruleId,
  };
}

// --- Lessons ---
async function rollbackFailedLessonCreate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { lessonId?: string; assignmentId?: string; removeAssignment?: boolean }
) {
  if (opts.lessonId) {
    await supabase.from("lessons").delete().eq("id", opts.lessonId);
  }
  if (opts.removeAssignment && opts.assignmentId) {
    await supabase
      .from("teacher_teaching_assignments")
      .delete()
      .eq("id", opts.assignmentId);
  }
}

export async function createLessonAction(formData: FormData) {
  const payload = await buildLessonPayload(formData);
  if ("error" in payload) return payload;

  const isNewAssignment = !String(formData.get("teacher_teaching_assignment_id") ?? "").trim();
  const assignmentId = payload.teacher_teaching_assignment_id;

  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert(payload)
    .select("id")
    .single();
  if (error || !lesson) {
    await rollbackFailedLessonCreate(supabase, {
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return { error: error?.message ?? "יצירת שיעור נכשלה" };
  }

  try {
    await generateLessonOccurrences(lesson.id);
  } catch (e) {
    await rollbackFailedLessonCreate(supabase, {
      lessonId: lesson.id,
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return { error: (e as Error).message };
  }

  await autoAssignStudentsToLesson(lesson.id, payload.academic_year_id);

  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/teachers");
  return { success: true };
}

export async function createLessonForDateAction(formData: FormData) {
  const occurrenceDate = requireText(formData.get("occurrence_date"), "תאריך");
  if (isError(occurrenceDate)) return occurrenceDate;

  const payload = await buildLessonPayload(formData);
  if ("error" in payload) return payload;

  const isNewAssignment = !String(formData.get("teacher_teaching_assignment_id") ?? "").trim();
  const assignmentId = payload.teacher_teaching_assignment_id;

  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert(payload)
    .select("id")
    .single();

  if (error || !lesson) {
    await rollbackFailedLessonCreate(supabase, {
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return { error: error?.message ?? "יצירת שיעור נכשלה" };
  }

  try {
    await generateLessonOccurrences(lesson.id);
  } catch (e) {
    await rollbackFailedLessonCreate(supabase, {
      lessonId: lesson.id,
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return { error: (e as Error).message };
  }

  await autoAssignStudentsToLesson(lesson.id, payload.academic_year_id);

  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/teachers");
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
    .update({ status: "cancelled", gap_handling: null })
    .eq("id", occurrenceId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  return { success: true };
}

export async function setOccurrenceGapHandlingAction(
  occurrenceId: string,
  handling: "in_treatment" | "continued"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ gap_handling: handling })
    .eq("id", occurrenceId);
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return { success: true };
}

export async function upsertAttendanceNoteAction(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה");
  if (isError(yearId)) return yearId;
  const body = requireText(formData.get("body"), "הערה");
  if (isError(body)) return body;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  const lessonId = String(formData.get("lesson_id") ?? "").trim() || null;
  if (!studentId && !lessonId) return { error: "חסר הקשר להערה" };
  if (studentId && lessonId) return { error: "הערה כללית היא לתלמידה או לשיעור, לא לשניהם" };

  const supabase = await createClient();
  const row = {
    academic_year_id: yearId,
    student_id: studentId,
    lesson_id: lessonId,
    body,
    updated_at: new Date().toISOString(),
  };

  if (studentId) {
    const { data: existing } = await supabase
      .from("attendance_notes")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("attendance_notes").update(row).eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("attendance_notes").insert(row);
      if (error) return { error: error.message };
    }
  } else {
    const { data: existing } = await supabase
      .from("attendance_notes")
      .select("id")
      .eq("academic_year_id", yearId)
      .eq("lesson_id", lessonId!)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("attendance_notes").update(row).eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("attendance_notes").insert(row);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/attendance");
  return { success: true };
}

export async function upsertMakeupExamAction(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה");
  if (isError(yearId)) return yearId;
  const studentId = requireId(formData.get("student_id"), "תלמידה");
  if (isError(studentId)) return studentId;
  const lessonId = requireId(formData.get("lesson_id"), "שיעור");
  if (isError(lessonId)) return lessonId;
  const required = parseInt(String(formData.get("required_exams") ?? "1"), 10);
  if (Number.isNaN(required) || required < 1 || required > 4) {
    return { error: "מספר מבחנים חייב להיות בין 1 ל-4" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("makeup_exams").upsert(
    {
      academic_year_id: yearId,
      student_id: studentId,
      lesson_id: lessonId,
      required_exams: required,
      status: "open",
    },
    { onConflict: "student_id,lesson_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/makeup");
  return { success: true };
}

export async function updateMakeupExamAction(id: string, formData: FormData) {
  const completed = parseInt(String(formData.get("completed_exams") ?? "0"), 10);
  const required = parseInt(String(formData.get("required_exams") ?? "1"), 10);
  const status = String(formData.get("status") ?? "open");
  if (!["open", "done", "blocked"].includes(status)) return { error: "סטטוס לא תקין" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("makeup_exams")
    .update({
      completed_exams: Number.isNaN(completed) ? 0 : completed,
      required_exams: Number.isNaN(required) ? 1 : required,
      status,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/makeup");
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

  const occurrenceIds = [...new Set(updates.map((u) => u.occurrenceId))];
  if (occurrenceIds.length > 0) {
    await supabase
      .from("lesson_occurrences")
      .update({ gap_handling: null, status: "completed" })
      .in("id", occurrenceIds);
  }

  revalidatePath("/attendance");
  return { success: true };
}
