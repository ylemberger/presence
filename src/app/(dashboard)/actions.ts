"use server";

import { revalidatePath as nextRevalidatePath } from "next/cache";
import {
  bustAttendanceShellCache,
  bustPendingAttendanceCache,
} from "@/lib/attendance/shell-cache";

function revalidatePath(path: string, type?: "layout" | "page") {
  if (path === "/attendance") {
    bustPendingAttendanceCache();
  }
  if (
    path === "/lessons" ||
    path === "/students" ||
    path === "/teachers" ||
    path === "/settings" ||
    path.startsWith("/students/") ||
    path.startsWith("/teachers/")
  ) {
    bustAttendanceShellCache();
  }
  if (type) nextRevalidatePath(path, type);
  else nextRevalidatePath(path);
}
import { createActionClient, createClient } from "@/lib/supabase/server";
import { setActiveAcademicYear, getActiveAcademicYear } from "@/lib/utils";
import { syncTeacherSourceRecords } from "@/lib/sync/teachers";
import { generateLessonOccurrences, applyHolidaysToAllOccurrences, syncLessonOccurrences, addOccurrenceMeetingsForDate } from "@/lib/lessons/occurrences";
import { toggleHolidayDate, isMissingHolidayKind } from "@/lib/lessons/holidays";
import {
  audienceForLesson,
  audienceMapFromRows,
  autoAssignStudentsToLesson,
  lessonMismatchMessage,
  refreshAutomaticLessonAssignmentsForStudent,
  refreshAutomaticAssignmentsForLesson,
} from "@/lib/lessons/autoAssign";
import {
  ensureFixedGrades,
  promoteStudentsToYear,
  copyYearStructure,
  repairMissingPromotions,
} from "@/lib/years/promote";
import { filterFixedGrades, FIXED_GRADE_NAMES } from "@/lib/years/grades";
import {
  buildStudentImportTemplate,
  MAX_STUDENT_IMPORT_BYTES,
  parseStudentImportWorkbook,
  type StudentImportCatalogs,
  type StudentImportParseResult,
} from "@/lib/students/excelImport";
import { applyStudentImportRows } from "@/lib/students/importApply";
import type { AttendanceStatus, HolidayKind } from "@/types/database";
import { todayIso, formatHebrewDate } from "@/lib/dates/hebrew";
import { embedOne } from "@/lib/supabase/embed";
import { resolveOrCreateSubject } from "@/lib/lessons/subjects";
import { formatLessonHours } from "@/lib/lessons/hours";
import { fingerprintForLesson } from "@/lib/attendance/pools";
import { uniqueCoveredStudentIds } from "@/lib/attendance/roster";
import { previousWeekStartBlockMessage } from "@/lib/attendance/previous-week";
import {
  FLEXIBLE_RANGE_FORM_VALUE,
  isFlexibleActivityRange,
} from "@/lib/lessons/flexible-range";
import {
  parseWeeklySlotsFromFormData,
  primarySlot,
  slotsFromLessonAndRows,
  type WeeklySlot,
} from "@/lib/lessons/weekly-slots";
import { chunkIds, fetchAllPages } from "@/lib/supabase/paged";
import {
  isError,
  parseLessonBilling,
  parseLessonGradeIds,
  requireId,
  requireIsoDate,
  requireText,
  requireUuid,
  validateEmail,
  validateIsraeliId,
  validatePhone,
} from "@/lib/validation";
import { hebrewDbError } from "@/lib/db/hebrew-error";

function thrownHebrew(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return /[\u0590-\u05FF]/.test(message) ? message : fallback;
}

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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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

  if (previousActive?.id) {
    await copyYearStructure(previousActive.id, created.id, supabase);
  }

  let promoteResult = null;
  if (shouldPromote && previousActive?.id) {
    promoteResult = await promoteStudentsToYear(previousActive.id, created.id, supabase);
  }

  revalidatePath("/settings");
  revalidatePath("/students");
  return { success: true, promoteResult };
}

export async function deleteAcademicYearAction(id: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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

/** Restore missing placements in the active year from the previous year's data. */
export async function repairMissingPromotionsAction() {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: active } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  if (!active) return { error: "אין שנה פעילה" };

  const result = await repairMissingPromotions(active.id, undefined, supabase);
  if (result.error) return { error: result.error };

  revalidatePath("/students");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true, result };
}

// --- Generic year-scoped entity CRUD helpers ---
async function createYearEntity(
  table:
    | "grades"
    | "classes"
    | "tracks"
    | "specializations"
    | "subjects"
    | "activity_ranges",
  data: Record<string, unknown>
) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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

export async function createSubjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש להזין שם מקצוע" };
  const result = await createYearEntity("subjects", {
    academic_year_id: formData.get("academic_year_id"),
    name,
  });
  if (!("error" in result && result.error)) {
    revalidatePath("/lessons");
  }
  return result;
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

function revalidateLessonCalendarPaths() {
  revalidatePath("/settings");
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/timetable");
}

function parseHolidayKind(raw: unknown): HolidayKind | { error: string } {
  const kind = String(raw ?? "vacation").trim();
  if (kind === "vacation" || kind === "cancelled_studies") return kind;
  return { error: "יש לבחור סוג: חופשה או ביטול לימודים" };
}

function parseHolidayPeriodForm(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const name = requireText(formData.get("name"), "שם");
  if (isError(name)) return name;
  const kind = parseHolidayKind(formData.get("kind"));
  if (isError(kind)) return kind;
  const startDate = requireIsoDate(formData.get("start_date"), "תאריך התחלה");
  if (isError(startDate)) return startDate;
  const endRaw = String(formData.get("end_date") ?? "").trim().slice(0, 10);
  const endDate = requireIsoDate(endRaw || startDate, "תאריך סיום");
  if (isError(endDate)) return endDate;
  if (endDate < startDate) {
    return { error: "תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה" };
  }
  return {
    academic_year_id: yearId,
    name,
    kind,
    start_date: startDate,
    end_date: endDate,
  };
}

function holidayWriteError(error: { message?: string; code?: string } | null): string {
  if (isMissingHolidayKind(error)) {
    return "יש להריץ ב-Supabase את הקובץ supabase/patches/009_holiday_kinds_and_student_notes.sql";
  }
  return "שמירת לוח החופשות נכשלה";
}

export async function createHolidayPeriodAction(formData: FormData) {
  const payload = parseHolidayPeriodForm(formData);
  if ("error" in payload) return payload;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { error } = await supabase.from("holiday_periods").insert(payload);
  if (error) return { error: holidayWriteError(error) };

  try {
    await applyHolidaysToAllOccurrences(supabase);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidateLessonCalendarPaths();
  return { success: true };
}

export async function updateHolidayPeriodAction(id: string, formData: FormData) {
  const payload = parseHolidayPeriodForm(formData);
  if ("error" in payload) return payload;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { error } = await supabase
    .from("holiday_periods")
    .update({
      name: payload.name,
      kind: payload.kind,
      start_date: payload.start_date,
      end_date: payload.end_date,
    })
    .eq("id", id);
  if (error) return { error: holidayWriteError(error) };

  try {
    await applyHolidaysToAllOccurrences(supabase);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidateLessonCalendarPaths();
  return { success: true };
}

export async function deleteHolidayPeriodAction(id: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: existing, error: loadError } = await supabase
    .from("holiday_periods")
    .select("academic_year_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!existing) return { error: "תקופת החופשה לא נמצאה" };

  const { error } = await supabase.from("holiday_periods").delete().eq("id", id);
  if (error) return { error: error.message };

  try {
    await applyHolidaysToAllOccurrences(supabase);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidateLessonCalendarPaths();
  return { success: true };
}

export async function toggleHolidayDayAction(
  yearId: string,
  iso: string,
  kind: HolidayKind,
  name: string
) {
  const date = requireIsoDate(iso, "תאריך");
  if (isError(date)) return date;
  const year = requireId(yearId, "שנה אקדמית");
  if (isError(year)) return year;
  const parsedKind = parseHolidayKind(kind);
  if (isError(parsedKind)) return parsedKind;
  const label =
    String(name ?? "").trim() ||
    (parsedKind === "cancelled_studies" ? "ביטול לימודים" : "חופשה");

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };

  const toggled = await toggleHolidayDate(actionAuth.supabase, year, date, parsedKind, label);
  if (toggled.error) return toggled;

  try {
    await applyHolidaysToAllOccurrences(actionAuth.supabase);
  } catch {
    return { error: "היום נשמר, אך רענון מופעי השיעור נכשל" };
  }

  revalidateLessonCalendarPaths();
  return { success: true };
}

export async function createAttendanceRuleAction(formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
    | "subjects"
    | "activity_ranges"
    | "attendance_rules",
  id: string,
  checks: Array<{ table: string; column: string }>,
  entityLabel: string
) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const result = await tryDeleteUnusedSpecialization(supabase, id);
  if (result.error) return { error: result.error };
  revalidatePath("/settings");
  return {};
}

export async function deleteUnusedSpecializationsAction(yearId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const year = requireId(yearId, "שנה");
  if (isError(year)) return { error: year.error };

  const { data: specs, error } = await supabase
    .from("specializations")
    .select("id")
    .eq("academic_year_id", year);
  if (error) return { error: "טעינת ההתמחויות נכשלה" };

  let deleted = 0;
  let skipped = 0;
  for (const spec of specs ?? []) {
    const result = await tryDeleteUnusedSpecialization(supabase, spec.id);
    if (result.error) skipped += 1;
    else deleted += 1;
  }
  revalidatePath("/settings");
  if (deleted === 0 && skipped > 0) {
    return { error: "אין התמחויות למחיקה בלי תלמידות או שיעורים" };
  }
  return { success: true, deleted, skipped };
}

async function tryDeleteUnusedSpecialization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<{ error?: string }> {
  const studentPrimary = await countRefs(supabase, "student_assignments", "specialization_id", id);
  const studentSecondary = await countRefs(
    supabase,
    "student_assignments",
    "secondary_specialization_id",
    id
  );
  if (studentPrimary + studentSecondary > 0) {
    return { error: "לא ניתן למחוק — יש תלמידות משובצות להתמחות זו" };
  }

  const lessonRefs = await countRefs(supabase, "lessons", "specialization_id", id);
  const audienceRefs = await countRefs(supabase, "lesson_audience", "specialization_id", id);
  if (lessonRefs + audienceRefs > 0) {
    return { error: "לא ניתן למחוק — יש שיעורים בהתמחות זו" };
  }

  const { data: teaching } = await supabase
    .from("teacher_teaching_assignments")
    .select("id")
    .eq("specialization_id", id);
  const teachingIds = (teaching ?? []).map((row) => row.id);
  if (teachingIds.length > 0) {
    const { count: teachingLessons } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .in("teacher_teaching_assignment_id", teachingIds);
    if ((teachingLessons ?? 0) > 0) {
      return { error: "לא ניתן למחוק — יש שיעורים המשויכים לשיבוץ הוראה של התמחות זו" };
    }
    const { error: teachingError } = await supabase
      .from("teacher_teaching_assignments")
      .delete()
      .in("id", teachingIds);
    if (teachingError) return { error: "לא ניתן לשחרר שיבוצי הוראה לא בשימוש" };
  }

  const { error } = await supabase.from("specializations").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSubjectAction(id: string) {
  return deleteEntityWithChecks(
    "subjects",
    id,
    [
      { table: "lessons", column: "subject_id" },
      { table: "makeup_exams", column: "subject_id" },
    ],
    "מקצוע"
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase.from("grades").update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateClassAction(id: string, formData: FormData) {
  const gradeId = String(formData.get("grade_id") ?? "").trim();
  if (!gradeId) return { error: "יש לבחור שכבה (א / ב / ג)" };

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase
    .from("tracks")
    .update({ name: formData.get("name") as string })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateSpecializationAction(id: string, formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase
    .from("specializations")
    .update({ name: formData.get("name") as string })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateSubjectAction(id: string, formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש להזין שם מקצוע" };
  const { error } = await supabase.from("subjects").update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/lessons");
  return { success: true };
}

export async function updateActivityRangeAction(id: string, formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  return { success: true };
}

export async function updateAttendanceRuleAction(id: string, formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
function buildStudentFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
}

function parseOptionalText(value: FormDataEntryValue | null, max = 200): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  return t.slice(0, max);
}

function parseChetzProgram(formData: FormData): boolean {
  const raw = String(formData.get("chetz_program") ?? "").trim().toLowerCase();
  return (
    formData.get("chetz_program") === "on" ||
    formData.get("chetz_program") === "1" ||
    raw === "כן" ||
    raw === "true" ||
    raw === "yes"
  );
}

export async function createStudentAction(formData: FormData) {
  const firstName = requireText(formData.get("first_name"), "שם פרטי");
  if (isError(firstName)) return firstName;
  const lastName = requireText(formData.get("last_name"), "שם משפחה");
  if (isError(lastName)) return lastName;
  const fullName = buildStudentFullName(firstName, lastName);
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
  const specId = requireId(formData.get("specialization_id"), "התמחות");
  if (isError(specId)) return specId;
  const secondarySpecId =
    String(formData.get("secondary_specialization_id") ?? "").trim() || null;
  if (secondarySpecId && secondarySpecId === specId) {
    return { error: "התמחות נוספת חייבת להיות שונה מההתמחות הראשית" };
  }
  const isPsychology =
    formData.get("is_psychology") === "on" || formData.get("is_psychology") === "1";

  const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
  if (birthDateRaw) {
    const birthOk = requireIsoDate(birthDateRaw, "ת.ל. לועזי");
    if (isError(birthOk)) return birthOk;
  }

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { data: student, error } = await supabase
    .from("students")
    .insert({
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      mi: parseOptionalText(formData.get("mi"), 40),
      identity_number: identity,
      cohort_number: cohortNumber,
      birth_date: birthDateRaw || null,
      birth_date_hebrew: parseOptionalText(formData.get("birth_date_hebrew"), 80),
      address: parseOptionalText(formData.get("address"), 200),
      city: parseOptionalText(formData.get("city"), 80),
      phone: parseOptionalText(formData.get("phone"), 40),
      father_phone: parseOptionalText(formData.get("father_phone"), 40),
      mother_phone: parseOptionalText(formData.get("mother_phone"), 40),
      student_phone: parseOptionalText(formData.get("student_phone"), 40),
      high_school: parseOptionalText(formData.get("high_school"), 120),
      chetz_program: parseChetzProgram(formData),
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

  try {
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
      startDate,
      supabase
    );
  } catch (error) {
    return {
      error: thrownHebrew(
        error,
        "התלמידה נוצרה, אבל שיוך השיעורים שלה נכשל. אפשר לשייך מהכרטיס שלה."
      ),
    };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${student.id}`);
  return { success: true };
}

/**
 * Student who left: never DELETE the students row.
 * Only this student_id: close open class placement, drop her lesson links, mark inactive.
 */
export async function leaveStudentAction(studentId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const sid = requireUuid(studentId, "תלמידה");
  if (isError(sid)) return sid;

  const { data: student, error: loadError } = await supabase
    .from("students")
    .select("id")
    .eq("id", sid)
    .maybeSingle();
  if (loadError) return { error: hebrewDbError(loadError, "טעינת התלמידה נכשלה") };
  if (!student?.id || student.id !== sid) return { error: "התלמידה לא נמצאה" };

  const today = todayIso();
  const { data: openPlacements, error: openError } = await supabase
    .from("student_assignments")
    .select("id, start_date")
    .eq("student_id", sid)
    .is("end_date", null);
  if (openError) return { error: hebrewDbError(openError, "סגירת השיבוץ נכשלה") };

  for (const row of openPlacements ?? []) {
    const endDate = row.start_date && row.start_date > today ? row.start_date : today;
    const { error: closeError } = await supabase
      .from("student_assignments")
      .update({ end_date: endDate })
      .eq("id", row.id)
      .eq("student_id", sid)
      .is("end_date", null);
    if (closeError) return { error: hebrewDbError(closeError, "סגירת השיבוץ נכשלה") };
  }

  const { error: unlinkError } = await supabase
    .from("student_lesson_assignments")
    .delete()
    .eq("student_id", sid);
  if (unlinkError) return { error: hebrewDbError(unlinkError, "הסרת השיוך לשיעורים נכשלה") };

  const { error: exclusionError } = await supabase
    .from("student_lesson_exclusions")
    .delete()
    .eq("student_id", sid);
  if (exclusionError && !/student_lesson_exclusions|schema cache|PGRST205|42P01/i.test(exclusionError.message)) {
    return { error: hebrewDbError(exclusionError, "הסרת החרגות השיעור נכשלה") };
  }

  const { data: deactivated, error: deactivateError } = await supabase
    .from("students")
    .update({ is_active: false })
    .eq("id", sid)
    .select("id");
  if (deactivateError) return { error: hebrewDbError(deactivateError, "עדכון התלמידה נכשל") };
  if (!deactivated?.some((row) => row.id === sid)) {
    return { error: "התלמידה לא עודכנה" };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${sid}`);
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/lessons");
  revalidatePath("/timetable");
  return { success: true };
}

export async function updateStudentAction(id: string, formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const firstName = requireText(formData.get("first_name"), "שם פרטי");
  if (isError(firstName)) return firstName;
  const lastName = requireText(formData.get("last_name"), "שם משפחה");
  if (isError(lastName)) return lastName;
  const cohortRaw = String(formData.get("cohort_number") ?? "").trim();
  const cohortNumber = parseInt(cohortRaw, 10);
  const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
  if (birthDateRaw) {
    const birthOk = requireIsoDate(birthDateRaw, "ת.ל. לועזי");
    if (isError(birthOk)) return birthOk;
  }

  const identity = validateIsraeliId(String(formData.get("identity_number") ?? ""));
  if (isError(identity)) return identity;

  const patch: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    full_name: buildStudentFullName(firstName, lastName),
    identity_number: identity,
    is_active: formData.get("is_active") === "on",
    mi: parseOptionalText(formData.get("mi"), 40),
    birth_date: birthDateRaw || null,
    birth_date_hebrew: parseOptionalText(formData.get("birth_date_hebrew"), 80),
    address: parseOptionalText(formData.get("address"), 200),
    city: parseOptionalText(formData.get("city"), 80),
    phone: parseOptionalText(formData.get("phone"), 40),
    father_phone: parseOptionalText(formData.get("father_phone"), 40),
    mother_phone: parseOptionalText(formData.get("mother_phone"), 40),
    student_phone: parseOptionalText(formData.get("student_phone"), 40),
    high_school: parseOptionalText(formData.get("high_school"), 120),
    chetz_program: parseChetzProgram(formData),
  };
  if (cohortRaw && !Number.isNaN(cohortNumber) && cohortNumber >= 1) {
    patch.cohort_number = cohortNumber;
  }
  const { error } = await supabase.from("students").update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "מספר תעודת זהות כבר קיים במערכת" };
    return { error: hebrewDbError(error, "שמירת פרטי התלמידה נכשלה") };
  }
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: true };
}

export async function updateStudentPersonalNoteAction(formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const id = requireId(formData.get("student_id"), "תלמידה");
  if (isError(id)) return id;
  const note = String(formData.get("personal_note") ?? "").trim();
  if (note.length > 2000) return { error: "ההערה ארוכה מדי" };

  const { error } = await actionAuth.supabase
    .from("students")
    .update({ personal_note: note || null })
    .eq("id", id);
  if (error) {
    if (/personal_note|PGRST204/i.test(error.message)) {
      return { error: "יש להריץ ב-Supabase את הקובץ supabase/patches/009_holiday_kinds_and_student_notes.sql" };
    }
    return { error: "שמירת ההערה נכשלה" };
  }
  revalidatePath(`/students/${id}`);
  return { success: true };
}

export async function createStudentLessonAssignmentAction(formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const studentId = requireUuid(formData.get("student_id"), "תלמידה");
  if (isError(studentId)) return { error: "יש לבחור תלמידה מהרשימה" };
  const lessonId = requireUuid(formData.get("lesson_id"), "שיעור");
  if (isError(lessonId)) return { error: "יש לבחור שיעור מהרשימה" };
  const startDate = requireIsoDate(formData.get("start_date"), "מתאריך");
  if (isError(startDate)) return startDate;
  const endRaw = String(formData.get("end_date") ?? "").trim();
  let endDate: string | null = null;
  if (endRaw) {
    const parsedEnd = requireIsoDate(endRaw, "עד תאריך");
    if (isError(parsedEnd)) return parsedEnd;
    endDate = parsedEnd;
  }
  if (endDate && endDate < startDate) {
    return { error: "תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה" };
  }
  const force = formData.get("force_mismatch") === "1";

  const [{ data: lesson, error: lessonError }, { data: audience, error: audienceError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          "id, academic_year_id, class_id, track_id, specialization_id, billing_type, grade_id, subject, for_psychology"
        )
        .eq("id", lessonId)
        .maybeSingle(),
      supabase
        .from("lesson_audience")
        .select("lesson_id, grade_id, class_id, track_id, specialization_id")
        .eq("lesson_id", lessonId),
    ]);

  if (lessonError) return { error: hebrewDbError(lessonError, "השיעור לא נמצא") };
  if (audienceError) return { error: hebrewDbError(audienceError, "לא ניתן לקרוא את קהל השיעור") };
  if (!lesson) return { error: "השיעור לא נמצא" };

  const { data: placement, error: placementError } = await supabase
    .from("student_assignments")
    .select(
      "class_id, track_id, specialization_id, secondary_specialization_id, grade_id, is_psychology"
    )
    .eq("student_id", studentId)
    .eq("academic_year_id", lesson.academic_year_id)
    .is("end_date", null)
    .maybeSingle();
  if (placementError) {
    if (placementError.code === "PGRST116") {
      return { error: "לתלמידה יש יותר משיבוץ פתוח אחד בשנה הזו. צריך לסגור את הכפילות לפני שיוך לשיעור." };
    }
    return { error: hebrewDbError(placementError, "לא ניתן לקרוא את השיבוץ של התלמידה") };
  }
  if (!placement) return { error: "לתלמידה אין שיבוץ פעיל בשנה של השיעור" };

  const scoped = {
    ...lesson,
    audience: audienceForLesson(lesson, audienceMapFromRows(audience ?? [])),
  };
  const mismatch = lessonMismatchMessage(placement, scoped);
  if (mismatch && !force) {
    return { error: mismatch, code: "mismatch" as const };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("student_lesson_assignments")
    .select("id, start_date, end_date")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId);
  if (existingError) {
    return { error: hebrewDbError(existingError, "לא ניתן לשייך את התלמידה לשיעור") };
  }

  const newEnd = endDate ?? "9999-12-31";
  const overlapping = (existingRows ?? []).filter((row) => {
    const start = String(row.start_date).slice(0, 10);
    const end = row.end_date ? String(row.end_date).slice(0, 10) : "9999-12-31";
    return start <= newEnd && startDate <= end;
  });
  if (overlapping.length > 0) {
    const only = overlapping.length === 1 ? overlapping[0] : null;
    const onlyStart = only ? String(only.start_date).slice(0, 10) : "";
    if (only && !only.end_date && !endDate && startDate < onlyStart) {
      const { error } = await supabase
        .from("student_lesson_assignments")
        .update({ start_date: startDate })
        .eq("id", only.id);
      if (error) {
        return {
          error: hebrewDbError(
            error,
            "התלמידה כבר משויכת לשיעור, אבל לא ניתן להקדים את תאריך השיוך"
          ),
        };
      }
    } else {
      return {
        error:
          "התלמידה כבר משויכת לשיעור הזה בתאריכים האלה. לא נוסף שיוך נוסף. שיוך מיותר אפשר להסיר מהרשימה.",
      };
    }
  } else {
    const { error } = await supabase.from("student_lesson_assignments").insert({
      student_id: studentId,
      lesson_id: lessonId,
      assignment_type: "manual",
      start_date: startDate,
      end_date: endDate,
    });
    if (error) return { error: hebrewDbError(error, "לא ניתן לשייך את התלמידה לשיעור") };
  }

  await supabase
    .from("student_lesson_exclusions")
    .delete()
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId);
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/lessons");
  return { success: true };
}

export async function deleteStudentLessonAssignmentAction(id: string, studentId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const assignmentId = requireUuid(id, "שיוך");
  if (isError(assignmentId)) return { error: "השיוך לא זוהה" };
  const sid = requireUuid(studentId, "תלמידה");
  if (isError(sid)) return { error: "התלמידה לא זוהתה" };

  const { data: row, error: loadError } = await supabase
    .from("student_lesson_assignments")
    .select("id, lesson_id, assignment_type, start_date, end_date")
    .eq("id", assignmentId)
    .eq("student_id", sid)
    .maybeSingle();
  if (loadError) return { error: hebrewDbError(loadError, "הסרת השיוך נכשלה") };
  if (!row) return { error: "השיוך לא נמצא" };

  const start = String(row.start_date).slice(0, 10);
  const today = todayIso();
  const manual = row.assignment_type === "manual";
  const notStarted = start > today;

  if (manual || notStarted) {
    const { data: deleted, error } = await supabase
      .from("student_lesson_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("student_id", sid)
      .select("id");
    if (error) return { error: hebrewDbError(error, "הסרת השיוך נכשלה") };
    if ((deleted?.length ?? 0) !== 1) return { error: "הסרת השיוך נכשלה" };
  } else {
    const { data: updated, error } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: today })
      .eq("id", assignmentId)
      .eq("student_id", sid)
      .select("id");
    if (error) return { error: hebrewDbError(error, "הסרת השיוך נכשלה") };
    if ((updated?.length ?? 0) !== 1) return { error: "הסרת השיוך נכשלה" };
  }

  const { data: rest, error: restError } = await supabase
    .from("student_lesson_assignments")
    .select("id, end_date")
    .eq("student_id", sid)
    .eq("lesson_id", row.lesson_id);
  if (restError) {
    return { error: "השיוך הוסר, אבל לא ניתן לבדוק אם נשארו שיוכים נוספים. רענני ונסי שוב." };
  }
  const stillCurrent = (rest ?? []).some((item) => {
    if (!item.end_date) return true;
    return String(item.end_date).slice(0, 10) >= today;
  });
  if (!stillCurrent) {
    const { error: exclusionError } = await supabase.from("student_lesson_exclusions").upsert({
      student_id: sid,
      lesson_id: row.lesson_id,
    });
    if (
      exclusionError &&
      !/student_lesson_exclusions|schema cache|PGRST205|42P01/i.test(exclusionError.message)
    ) {
      return { error: "השיוך הוסר, אבל לא ניתן לחסום חזרה אוטומטית לשיעור. נסי שוב." };
    }
  }

  revalidatePath(`/students/${sid}`);
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/lessons");
  return { success: true };
}

export async function excludeStudentFromLessonAction(studentId: string, lessonId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const sid = requireId(studentId, "תלמידה");
  if (isError(sid)) return sid;
  const lid = requireId(lessonId, "שיעור");
  if (isError(lid)) return lid;

  const { error: exclusionError } = await supabase.from("student_lesson_exclusions").upsert({
    student_id: sid,
    lesson_id: lid,
  });
  if (exclusionError) {
    if (/student_lesson_exclusions|schema cache|PGRST205|42P01/i.test(exclusionError.message)) {
      return { error: "יש להריץ ב-Supabase את הקובץ supabase/patches/018_student_lesson_exclusions.sql" };
    }
    return { error: "הסרת השיוך נכשלה" };
  }

  const { data: openRows, error: openError } = await supabase
    .from("student_lesson_assignments")
    .select("id, start_date")
    .eq("student_id", sid)
    .eq("lesson_id", lid)
    .is("end_date", null);
  if (openError) return { error: hebrewDbError(openError, "הסרת השיוך נכשלה") };
  const today = todayIso();
  for (const row of openRows ?? []) {
    const start = String(row.start_date).slice(0, 10);
    if (start > today) {
      const { error } = await supabase
        .from("student_lesson_assignments")
        .delete()
        .eq("id", row.id);
      if (error) return { error: hebrewDbError(error, "הסרת השיוך נכשלה") };
      continue;
    }
    const { error } = await supabase
      .from("student_lesson_assignments")
      .update({ end_date: today })
      .eq("id", row.id);
    if (error) return { error: hebrewDbError(error, "הסרת השיוך נכשלה") };
  }

  revalidatePath(`/students/${sid}`);
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/lessons");
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
  const startDate = requireIsoDate(
    formData.get("start_date") ?? formData.get("transfer_date"),
    "בתוקף מתאריך"
  );
  if (isError(startDate)) return startDate;
  const specId = requireId(formData.get("specialization_id"), "התמחות");
  if (isError(specId)) return specId;
  const secondarySpecId =
    String(formData.get("secondary_specialization_id") ?? "").trim() || null;
  if (secondarySpecId && secondarySpecId === specId) {
    return { error: "התמחות נוספת חייבת להיות שונה מההתמחות הראשית" };
  }
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

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { data: currentAssignment } = await supabase
    .from("student_assignments")
    .select("*")
    .eq("student_id", placement.student_id)
    .eq("academic_year_id", placement.academic_year_id)
    .is("end_date", null)
    .maybeSingle();

  if (currentAssignment) {
    if (placement.start_date < currentAssignment.start_date) {
      return { error: "תאריך ההעברה לא יכול להיות לפני תחילת השיבוץ הנוכחי" };
    }

    const samePlacement =
      currentAssignment.grade_id === placement.grade_id &&
      currentAssignment.class_id === placement.class_id &&
      currentAssignment.track_id === placement.track_id &&
      (currentAssignment.specialization_id ?? null) === placement.specialization_id &&
      (currentAssignment.secondary_specialization_id ?? null) ===
        placement.secondary_specialization_id &&
      Boolean(currentAssignment.is_psychology) === placement.is_psychology;
    if (samePlacement) {
      return { error: "לא בוצע שינוי בשיבוץ. בחרי התמחות, כיתה או מסלול אחרים." };
    }

    const nextPlacement = {
      grade_id: placement.grade_id,
      class_id: placement.class_id,
      track_id: placement.track_id,
      specialization_id: placement.specialization_id,
      secondary_specialization_id: placement.secondary_specialization_id,
      is_psychology: placement.is_psychology,
    };

    // Same calendar day: correct the open assignment (cannot close+open — overlap + end<start).
    if (placement.start_date === currentAssignment.start_date) {
      const { error: updateError } = await supabase
        .from("student_assignments")
        .update(nextPlacement)
        .eq("id", currentAssignment.id);
      if (updateError) return { error: hebrewDbError(updateError, "ההעברה נכשלה") };
    } else {
      const endDate = addDaysLocal(placement.start_date, -1);
      const { error: closeError } = await supabase
        .from("student_assignments")
        .update({ end_date: endDate })
        .eq("id", currentAssignment.id);
      if (closeError) return { error: hebrewDbError(closeError, "סגירת השיבוץ הקודם נכשלה") };

      const { error } = await supabase.from("student_assignments").insert({
        ...placement,
        end_date: null,
      });
      if (error) return { error: hebrewDbError(error, "ההעברה נכשלה") };
    }
  } else {
    const { error } = await supabase.from("student_assignments").insert({
      ...placement,
      end_date: null,
    });
    if (error) return { error: hebrewDbError(error, "ההעברה נכשלה") };
  }

  try {
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
      placement.start_date,
      supabase
    );
  } catch (error) {
    return {
      error: thrownHebrew(
        error,
        "השיבוץ עודכן, אבל עדכון השיעורים של התלמידה נכשל. נסי שוב."
      ),
    };
  }

  revalidatePath(`/students/${placement.student_id}`);
  revalidatePath("/attendance");
  revalidatePath("/lessons");
  revalidatePath("/reports");
  return { success: true };
}

// --- Teachers ---
export async function createTeacherAction(_formData: FormData) {
  return { error: "אי אפשר להוסיף מורה ידנית. מורות נכנסות ממערכת השכר אחרי אישור." };
}

export async function createSourceRecordAction(_formData: FormData) {
  return { error: "אי אפשר להוסיף רשומת מקור ידנית. מורות נכנסות ממערכת השכר אחרי אישור." };
}

export async function updateTeacherAction(formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const id = requireId(formData.get("teacher_id"), "מורה");
  if (isError(id)) return id;
  const fullName = requireText(formData.get("full_name"), "שם מלא");
  if (isError(fullName)) return fullName;

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    const parsed = validatePhone(phoneRaw);
    if (isError(parsed)) return parsed;
    phone = parsed;
  }

  const emailRaw = String(formData.get("email") ?? "").trim();
  let email: string | null = null;
  if (emailRaw) {
    const parsed = validateEmail(emailRaw);
    if (isError(parsed)) return parsed;
    email = parsed;
  }

  const patch: {
    full_name: string;
    is_local: boolean;
    phone?: string;
    email?: string;
  } = { full_name: fullName, is_local: true };
  if (phone) patch.phone = phone;
  if (email) patch.email = email;

  const { error } = await supabase.from("teachers").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  revalidatePath(`/teachers/${id}`);
  return { success: true };
}

export async function syncTeachersAction() {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  try {
    const result = await syncTeacherSourceRecords(actionAuth.supabase);
    revalidatePath("/teachers");
    return { success: true, result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "סנכרון המורות נכשל" };
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
  const subject = requireText(
    formData.get("lesson_name") || formData.get("subject"),
    "שם שיעור"
  );
  if (isError(subject)) return subject;
  const gradeIds = parseLessonGradeIds(formData);
  if ("error" in gradeIds) return gradeIds;
  const gradeId = gradeIds[0];
  const billing = parseLessonBilling(formData);
  if ("error" in billing) return billing;

  if (billing.class_ids.length > 0) {
    const allowedGrades = new Set(gradeIds);
    const { data: clsRows } = await supabase
      .from("classes")
      .select("id, grade_id")
      .in("id", billing.class_ids);
    if ((clsRows ?? []).length !== billing.class_ids.length) {
      return { error: "אחת הכיתות שנבחרו אינה תקינה" };
    }
    if ((clsRows ?? []).some((c) => !allowedGrades.has(c.grade_id))) {
      return { error: "כל הכיתות חייבות להיות מתוך השכבות שנבחרו" };
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const result = await insertTeachingAssignmentFromForm(supabase, formData);
  if ("error" in result) return result;
  revalidatePath("/teachers");
  revalidatePath("/lessons");
  return { success: true };
}

async function maybeDeleteUnusedFlexibleRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rangeId: string | null | undefined
) {
  if (!rangeId) return;
  const { data: range } = await supabase
    .from("activity_ranges")
    .select("id, range_type")
    .eq("id", rangeId)
    .maybeSingle();
  if (!isFlexibleActivityRange(range)) return;
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("activity_range_id", rangeId);
  if ((count ?? 0) > 0) return;
  await supabase.from("activity_ranges").delete().eq("id", rangeId);
}

async function resolveOrCreateFlexibleRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string,
  endDate: string,
  yearId: string
) {
  const { data: existing } = await supabase
    .from("activity_ranges")
    .select("id")
    .eq("range_type", "flexible")
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const name =
    startDate === endDate
      ? `גמיש · ${formatHebrewDate(startDate)}`
      : `גמיש · ${formatHebrewDate(startDate)} – ${formatHebrewDate(endDate)}`;
  const { data: created, error } = await supabase
    .from("activity_ranges")
    .insert({
      academic_year_id: yearId,
      name,
      start_date: startDate,
      end_date: endDate,
      range_type: "flexible",
    })
    .select("id")
    .single();
  if (error || !created) {
    const msg = error?.message ?? "";
    if (msg.toLowerCase().includes("range_type") || msg.toLowerCase().includes("check")) {
      return {
        error: "יש להריץ ב-Supabase את הקובץ supabase/patches/021_flexible_activity_range.sql",
      };
    }
    return { error: "יצירת טווח גמיש נכשלה" };
  }
  return created.id;
}

async function resolveLessonActivityRangeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  yearId: string
) {
  const raw = String(formData.get("activity_range_id") ?? "").trim();
  if (raw === FLEXIBLE_RANGE_FORM_VALUE) {
    const start = requireIsoDate(formData.get("flexible_start_date"), "תחילת הטווח הגמיש");
    if (isError(start)) return start;
    const endRaw = String(formData.get("flexible_end_date") ?? "").trim();
    const end = requireIsoDate(endRaw || start, "סיום הטווח הגמיש");
    if (isError(end)) return end;
    if (end < start) {
      return { error: "תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה" };
    }
    return resolveOrCreateFlexibleRange(supabase, start, end, yearId);
  }
  return requireId(raw, "טווח פעילות");
}

async function buildLessonPayload(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה אקדמית");
  if (isError(yearId)) return yearId;
  const ruleId = requireId(formData.get("attendance_rule_id"), "כלל נוכחות");
  if (isError(ruleId)) return ruleId;

  const slots = parseWeeklySlotsFromFormData(formData);
  if ("error" in slots) return slots;
  const first = primarySlot(slots);
  const repeatRaw = Number(formData.get("repeat_every_weeks") ?? "1");
  const repeatEveryWeeks: 1 | 2 = repeatRaw === 2 ? 2 : 1;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const rangeId = await resolveLessonActivityRangeId(supabase, formData, yearId);
  if (isError(rangeId)) return rangeId;

  const lessonName = requireText(
    formData.get("lesson_name") || formData.get("subject"),
    "שם שיעור"
  );
  if (isError(lessonName)) return lessonName;

  const subjectName = String(
    formData.get("subject_name") ?? formData.get("new_subject_name") ?? ""
  ).trim();
  const subjectResolved = await resolveOrCreateSubject(
    supabase,
    yearId,
    String(formData.get("subject_id") ?? ""),
    subjectName || lessonName
  );
  if ("error" in subjectResolved) return subjectResolved;

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
    subject_id: subjectResolved.id,
    subject: lessonName,
    grade_id: gradeId,
    class_id: teaching.class_id,
    track_id: teaching.track_id,
    specialization_id: teaching.specialization_id,
    billing_type: teaching.billing_type as "mandatory" | "specialization",
    for_psychology: Boolean(teaching.for_psychology),
    day_of_week: first.dayOfWeek,
    lesson_number: first.lessonNumber,
    period_count: first.periodCount,
    repeat_every_weeks: repeatEveryWeeks,
    activity_range_id: rangeId,
    attendance_rule_id: ruleId,
    weekly_slots: slots,
  };
}

async function replaceLessonWeeklySlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  slots: WeeklySlot[]
) {
  const { error: clearError } = await supabase
    .from("lesson_weekly_slots")
    .delete()
    .eq("lesson_id", lessonId);
  if (clearError) {
    if (/lesson_weekly_slots|schema cache|PGRST205|42P01/i.test(clearError.message)) {
      return {
        error:
          "חסרה טבלת מפגשים שבועיים במסד — הריצי את supabase/patches/023_lesson_weekly_slots.sql",
      };
    }
    return { error: hebrewDbError(clearError, "עדכון מפגשי השבוע נכשל. לא נשמר.") };
  }
  if (slots.length === 0) return { success: true as const };
  const { error: insertError } = await supabase.from("lesson_weekly_slots").insert(
    slots.map((slot) => ({
      lesson_id: lessonId,
      day_of_week: slot.dayOfWeek,
      lesson_number: slot.lessonNumber,
      period_count: slot.periodCount,
    }))
  );
  if (insertError) {
    return { error: hebrewDbError(insertError, "שמירת מפגשי השבוע נכשלה. לא נשמר.") };
  }
  return { success: true as const };
}

function lessonAudienceRows(
  lessonId: string,
  gradeId: string,
  formData: FormData
): Array<{
  lesson_id: string;
  grade_id: string | null;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
}> | { error: string } {
  const billing = parseLessonBilling(formData);
  const gradeIdsParsed = parseLessonGradeIds(formData);
  if ("error" in billing) return billing;
  if ("error" in gradeIdsParsed) return gradeIdsParsed;
  const gradeIdsForAudience = gradeIdsParsed.length > 0 ? gradeIdsParsed : [gradeId];
  return [
    ...gradeIdsForAudience.map((grade_id) => ({
      lesson_id: lessonId,
      grade_id,
      class_id: null as string | null,
      track_id: null as string | null,
      specialization_id: null as string | null,
    })),
    ...billing.class_ids.map((class_id) => ({
      lesson_id: lessonId,
      grade_id: null as string | null,
      class_id,
      track_id: null as string | null,
      specialization_id: null as string | null,
    })),
    ...billing.track_ids.map((track_id) => ({
      lesson_id: lessonId,
      grade_id: null as string | null,
      class_id: null as string | null,
      track_id,
      specialization_id: null as string | null,
    })),
    ...billing.specialization_ids.map((specialization_id) => ({
      lesson_id: lessonId,
      grade_id: null as string | null,
      class_id: null as string | null,
      track_id: null as string | null,
      specialization_id,
    })),
  ];
}

function revalidateLessonPaths() {
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/teachers");
  revalidatePath("/settings");
  revalidatePath("/timetable");
  revalidatePath("/reports");
  revalidatePath("/makeup");
}

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

  const { weekly_slots: weeklySlots, ...lessonInsert } = payload;
  const isNewAssignment = !String(formData.get("teacher_teaching_assignment_id") ?? "").trim();
  const assignmentId = payload.teacher_teaching_assignment_id;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert(lessonInsert)
    .select("id")
    .single();
  if (error || !lesson) {
    await rollbackFailedLessonCreate(supabase, {
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return { error: hebrewDbError(error, "יצירת שיעור נכשלה. לא נשמר.") };
  }

  const slotsResult = await replaceLessonWeeklySlots(supabase, lesson.id, weeklySlots);
  if ("error" in slotsResult) {
    await rollbackFailedLessonCreate(supabase, {
      lessonId: lesson.id,
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return slotsResult;
  }

  const audienceRows = lessonAudienceRows(lesson.id, payload.grade_id, formData);
  if ("error" in audienceRows) {
    await rollbackFailedLessonCreate(supabase, {
      lessonId: lesson.id,
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return audienceRows;
  }
  if (audienceRows.length > 0) {
    const { error: audienceError } = await supabase.from("lesson_audience").insert(audienceRows);
    if (audienceError) {
      await rollbackFailedLessonCreate(supabase, {
        lessonId: lesson.id,
        assignmentId,
        removeAssignment: isNewAssignment,
      });
      return { error: hebrewDbError(audienceError, "שמירת קהל היעד של השיעור נכשלה. לא נשמר.") };
    }
  }

  try {
    await generateLessonOccurrences(lesson.id);
  } catch (e) {
    await rollbackFailedLessonCreate(supabase, {
      lessonId: lesson.id,
      assignmentId,
      removeAssignment: isNewAssignment,
    });
    return {
      error: hebrewDbError(
        { message: e instanceof Error ? e.message : "" },
        "פתיחת מופעי השיעור נכשלה. השיעור לא נשמר."
      ),
    };
  }

  await autoAssignStudentsToLesson(lesson.id, payload.academic_year_id, undefined, supabase);

  revalidateLessonPaths();
  return { success: true };
}

function idKey(ids: Array<string | null | undefined>): string {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort().join(",");
}

function scheduleKey(slots: WeeklySlot[], repeatEveryWeeks: number): string {
  const body = slots
    .map((slot) => `${slot.dayOfWeek}:${slot.lessonNumber}:${slot.periodCount}`)
    .join(",");
  return `${repeatEveryWeeks === 2 ? 2 : 1}|${body}`;
}

async function markedOccurrenceDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string
): Promise<string[]> {
  const rows = await fetchAllPages<{ id: string; occurrence_date: string }>((from, to) =>
    supabase
      .from("lesson_occurrences")
      .select("id, occurrence_date, attendance!inner(id)")
      .eq("lesson_id", lessonId)
      .order("occurrence_date")
      .order("id")
      .range(from, to)
  );
  return [...new Set(rows.map((row) => row.occurrence_date.slice(0, 10)))].sort();
}

async function requestedRangeBounds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<{ start: string; end: string } | { error: string }> {
  const raw = String(formData.get("activity_range_id") ?? "").trim();
  if (raw === FLEXIBLE_RANGE_FORM_VALUE) {
    const start = requireIsoDate(formData.get("flexible_start_date"), "תחילת הטווח הגמיש");
    if (isError(start)) return start;
    const endRaw = String(formData.get("flexible_end_date") ?? "").trim();
    const end = requireIsoDate(endRaw || start, "סיום הטווח הגמיש");
    if (isError(end)) return end;
    if (end < start) {
      return { error: "תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה" };
    }
    return { start, end };
  }
  const rangeId = requireId(raw, "טווח פעילות");
  if (isError(rangeId)) return rangeId;
  const { data, error } = await supabase
    .from("activity_ranges")
    .select("start_date, end_date")
    .eq("id", rangeId)
    .maybeSingle();
  if (error || !data?.start_date || !data.end_date) return { error: "טווח הפעילות לא נמצא" };
  return { start: data.start_date.slice(0, 10), end: data.end_date.slice(0, 10) };
}

export async function updateLessonAction(formData: FormData) {
  const lessonId = requireId(formData.get("lesson_id"), "שיעור");
  if (isError(lessonId)) return lessonId;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: existing, error: loadError } = await supabase
    .from("lessons")
    .select(
      "id, academic_year_id, teacher_teaching_assignment_id, activity_range_id, grade_id, class_id, track_id, specialization_id, billing_type, for_psychology, day_of_week, lesson_number, period_count, repeat_every_weeks"
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (loadError) return { error: "טעינת השיעור נכשלה" };
  if (!existing) return { error: "השיעור לא נמצא" };

  formData.set("teacher_teaching_assignment_id", existing.teacher_teaching_assignment_id);

  const teacherId = requireId(formData.get("teacher_id"), "מורה");
  if (isError(teacherId)) return teacherId;
  const lessonName = requireText(
    formData.get("lesson_name") || formData.get("subject"),
    "שם שיעור"
  );
  if (isError(lessonName)) return lessonName;
  const billing = parseLessonBilling(formData);
  if ("error" in billing) return billing;
  const gradeIds = parseLessonGradeIds(formData);
  if ("error" in gradeIds) return gradeIds;
  const formSlots = parseWeeklySlotsFromFormData(formData);
  if ("error" in formSlots) return formSlots;
  const formRepeat = Number(formData.get("repeat_every_weeks") ?? "1") === 2 ? 2 : 1;
  const bounds = await requestedRangeBounds(supabase, formData);
  if ("error" in bounds) return bounds;

  const [{ data: audienceRows, error: audienceLoadError }, { data: slotRows, error: slotLoadError }, { data: oldRange }, markedDates] =
    await Promise.all([
      supabase
        .from("lesson_audience")
        .select("grade_id, class_id, track_id, specialization_id")
        .eq("lesson_id", lessonId),
      supabase
        .from("lesson_weekly_slots")
        .select("day_of_week, lesson_number, period_count")
        .eq("lesson_id", lessonId),
      existing.activity_range_id
        ? supabase
            .from("activity_ranges")
            .select("start_date")
            .eq("id", existing.activity_range_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      markedOccurrenceDates(supabase, lessonId),
    ]);
  if (audienceLoadError) return { error: "טעינת פרטי השיעור נכשלה" };
  if (
    slotLoadError &&
    !/lesson_weekly_slots|schema cache|PGRST205|42P01/i.test(slotLoadError.message ?? "")
  ) {
    return { error: "טעינת פרטי השיעור נכשלה" };
  }

  const hasMarks = markedDates.length > 0;
  const storedSlots = slotsFromLessonAndRows(existing, slotRows ?? []);
  const audienceChanged =
    existing.billing_type !== billing.billing_type ||
    Boolean(existing.for_psychology) !== billing.for_psychology ||
    idKey([existing.grade_id, ...(audienceRows ?? []).map((row) => row.grade_id)]) !==
      idKey(gradeIds) ||
    idKey([existing.class_id, ...(audienceRows ?? []).map((row) => row.class_id)]) !==
      idKey(billing.class_ids) ||
    idKey([existing.track_id, ...(audienceRows ?? []).map((row) => row.track_id)]) !==
      idKey(billing.track_ids) ||
    idKey([
      existing.specialization_id,
      ...(audienceRows ?? []).map((row) => row.specialization_id),
    ]) !== idKey(billing.specialization_ids);
  const scheduleChanged =
    scheduleKey(storedSlots, existing.repeat_every_weeks === 2 ? 2 : 1) !==
    scheduleKey(formSlots, formRepeat);
  const outsideMarks = markedDates.filter((date) => date < bounds.start || date > bounds.end);

  if (hasMarks && audienceChanged) {
    return {
      error:
        "אי אפשר לשנות קהל יעד כל עוד יש נוכחות. אפשר לשנות שם, מורה וכלל נוכחות, וגם את טווח הפעילות אם כל מפגש שסומן נשאר בתוכו.",
    };
  }
  if (hasMarks && scheduleChanged) {
    return {
      error:
        "אי אפשר לשנות יום, שעה, משך או תדירות כל עוד יש נוכחות. שינוי כזה היה משנה מפגשים שכבר סומנו.",
    };
  }
  if (outsideMarks.length > 0) {
    const shown = outsideMarks.slice(0, 8).map((date) => formatHebrewDate(date)).join(", ");
    return {
      error: `אי אפשר לשנות לטווח הזה כי יש נוכחות במפגשים מחוץ לו: ${shown}. הטווח החדש חייב לכלול כל מפגש שכבר סומן.`,
    };
  }

  const { error: ttaError } = await supabase
    .from("teacher_teaching_assignments")
    .update(
      hasMarks
        ? { teacher_id: teacherId, subject: lessonName }
        : {
            teacher_id: teacherId,
            subject: lessonName,
            billing_type: billing.billing_type,
            grade_id: gradeIds[0],
            class_id: billing.class_id,
            track_id: billing.track_id,
            specialization_id: billing.specialization_id,
            for_psychology: billing.for_psychology,
          }
    )
    .eq("id", existing.teacher_teaching_assignment_id);
  if (ttaError) return { error: hebrewDbError(ttaError, "עדכון שיבוץ ההוראה נכשל. לא נשמר.") };

  const payload = await buildLessonPayload(formData);
  if ("error" in payload) return payload;

  const lessonUpdate = hasMarks
    ? {
        subject_id: payload.subject_id,
        subject: payload.subject,
        activity_range_id: payload.activity_range_id,
        attendance_rule_id: payload.attendance_rule_id,
      }
    : {
        subject_id: payload.subject_id,
        subject: payload.subject,
        grade_id: payload.grade_id,
        class_id: payload.class_id,
        track_id: payload.track_id,
        specialization_id: payload.specialization_id,
        billing_type: payload.billing_type,
        for_psychology: payload.for_psychology,
        day_of_week: payload.day_of_week,
        lesson_number: payload.lesson_number,
        period_count: payload.period_count,
        repeat_every_weeks: payload.repeat_every_weeks,
        activity_range_id: payload.activity_range_id,
        attendance_rule_id: payload.attendance_rule_id,
      };
  const { error: updateError } = await supabase
    .from("lessons")
    .update(lessonUpdate)
    .eq("id", lessonId);
  if (updateError) {
    if (/repeat_every_weeks|schema cache/i.test(updateError.message)) {
      return {
        error:
          "חסרה במסד העמודה של תדירות השיעור. הריצי ב-Supabase את supabase/patches/024_lesson_number_13_and_fortnightly.sql ואז רענני את הדף.",
      };
    }
    return { error: hebrewDbError(updateError, "עדכון השיעור נכשל. לא נשמר.") };
  }

  if (!hasMarks) {
    const slotsResult = await replaceLessonWeeklySlots(
      supabase,
      lessonId,
      payload.weekly_slots
    );
    if ("error" in slotsResult) return slotsResult;

    const { error: clearAudienceError } = await supabase
      .from("lesson_audience")
      .delete()
      .eq("lesson_id", lessonId);
    if (clearAudienceError) return { error: "עדכון קהל היעד נכשל" };

    const nextAudience = lessonAudienceRows(lessonId, payload.grade_id, formData);
    if ("error" in nextAudience) return nextAudience;
    if (nextAudience.length > 0) {
      const { error: audienceError } = await supabase.from("lesson_audience").insert(nextAudience);
      if (audienceError) {
        return { error: hebrewDbError(audienceError, "עדכון קהל היעד נכשל. לא נשמר.") };
      }
    }
  }

  try {
    await syncLessonOccurrences(lessonId, supabase, { keepMarked: hasMarks });
  } catch (e) {
    return {
      error: hebrewDbError(
        { message: e instanceof Error ? e.message : "" },
        "עדכון מופעי השיעור נכשל. השיעור לא נשמר כמו שביקשת."
      ),
    };
  }

  const oldStart = oldRange?.start_date?.slice(0, 10) ?? "";
  const rangeStartChanged = oldStart !== bounds.start;
  try {
    if (!hasMarks || rangeStartChanged) {
      await refreshAutomaticAssignmentsForLesson(lessonId, payload.academic_year_id, supabase);
    }
  } catch (e) {
    return {
      error: hebrewDbError(
        { message: e instanceof Error ? e.message : "" },
        "עדכון שיוכי התלמידות נכשל. לא נשמר."
      ),
    };
  }

  if (existing.activity_range_id && existing.activity_range_id !== payload.activity_range_id) {
    await maybeDeleteUnusedFlexibleRange(supabase, existing.activity_range_id);
  }

  revalidateLessonPaths();
  return { success: true };
}

export async function deleteLessonAction(id: string) {
  const lessonId = requireId(id, "שיעור");
  if (isError(lessonId)) return lessonId;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: existing, error: loadError } = await supabase
    .from("lessons")
    .select("id, teacher_teaching_assignment_id, activity_range_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (loadError) return { error: "טעינת השיעור נכשלה" };
  if (!existing) return { error: "השיעור לא נמצא" };

  const teachingId = existing.teacher_teaching_assignment_id;

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { error: "מחיקת השיעור נכשלה" };

  await maybeDeleteUnusedFlexibleRange(supabase, existing.activity_range_id);

  if (teachingId) {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("teacher_teaching_assignment_id", teachingId);
    if ((count ?? 0) === 0) {
      await supabase.from("teacher_teaching_assignments").delete().eq("id", teachingId);
    }
  }

  revalidateLessonPaths();
  return { success: true };
}

export async function generateOccurrencesAction(academicYearId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };

  try {
    const result = await generateLessonOccurrences(undefined, academicYearId, actionAuth.supabase);
    revalidatePath("/lessons");
    return { success: true, result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelOccurrenceAction(occurrenceId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { error: "חסר מופע" };
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "cancelled", gap_handling: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/timetable");
  return { success: true };
}

export async function restoreCancelledOccurrenceAction(occurrenceId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { error: "חסר מופע" };
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "scheduled", gap_handling: null })
    .eq("id", id)
    .eq("status", "cancelled");
  if (error) return { error: "לא ניתן להחזיר את המופע" };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/timetable");
  return { success: true };
}

export async function createOccurrenceAction(formData: FormData) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const lessonId = requireId(formData.get("lesson_id"), "שיעור");
  if (isError(lessonId)) return lessonId;
  const date = requireIsoDate(formData.get("occurrence_date"), "תאריך");
  if (isError(date)) return date;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError || !lesson) return { error: "השיעור לא נמצא" };

  try {
    const created = await addOccurrenceMeetingsForDate(supabase, lessonId, date);
    revalidatePath("/lessons");
    revalidatePath("/attendance");
    return { success: true, occurrenceId: created.occurrenceId, date };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "הוספת התאריך נכשלה" };
  }
}

export async function setOccurrenceGapHandlingAction(
  occurrenceId: string,
  handling: "in_treatment" | "continued"
) {
  try {
    const actionAuth = await createActionClient();
    if ("error" in actionAuth) return { error: actionAuth.error };
    const supabase = actionAuth.supabase;
    const { data, error } = await supabase
      .from("lesson_occurrences")
      .update({ gap_handling: handling })
      .eq("id", occurrenceId)
      .select("id, gap_handling")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) {
      return { error: "לא נמצא המופע לעדכון. ייתכן שחסרה עמודת gap_handling במסד — הריצי את supabase/patches/022_occurrence_gap_handling.sql" };
    }
    revalidatePath("/attendance");
    revalidatePath("/");
    return { success: true as const, gapHandling: data.gap_handling as typeof handling };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "עדכון הטיפול בשיעור החסר נכשל" };
  }
}

function occurrenceNoteError(error: { message?: string; code?: string } | null): string {
  const msg = error?.message ?? "";
  if (/lesson_occurrence_id|schema cache|PGRST204|attendance_notes_one_target|check constraint/i.test(msg)) {
    return "הערת מופע עדיין לא פתוחה במסד. הריצי supabase/patches/030_occurrence_notes.sql ואז רענני. לא נשמר.";
  }
  return hebrewDbError(error, "שמירת ההערה נכשלה. לא נשמר.");
}

export async function upsertAttendanceNoteAction(formData: FormData) {
  const yearId = requireId(formData.get("academic_year_id"), "שנה");
  if (isError(yearId)) return yearId;
  const occurrenceRaw = String(formData.get("lesson_occurrence_id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  const lessonId = String(formData.get("lesson_id") ?? "").trim() || null;

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  if (occurrenceRaw) {
    const occurrenceId = requireUuid(occurrenceRaw, "מופע");
    if (isError(occurrenceId)) return occurrenceId;
    const body = String(formData.get("body") ?? "").trim();
    const { data: occ, error: occError } = await supabase
      .from("lesson_occurrences")
      .select("id, lessons!inner(academic_year_id)")
      .eq("id", occurrenceId)
      .eq("lessons.academic_year_id", yearId)
      .maybeSingle();
    if (occError || !occ) return { error: "המופע לא נמצא" };

    const { data: existing, error: loadError } = await supabase
      .from("attendance_notes")
      .select("id")
      .eq("lesson_occurrence_id", occurrenceId)
      .maybeSingle();
    if (loadError) return { error: occurrenceNoteError(loadError) };

    if (!body) {
      if (!existing) {
        revalidatePath("/attendance");
        return { success: true };
      }
      const { error } = await supabase.from("attendance_notes").delete().eq("id", existing.id);
      if (error) return { error: occurrenceNoteError(error) };
      revalidatePath("/attendance");
      return { success: true };
    }

    const row = {
      academic_year_id: yearId,
      student_id: null,
      lesson_id: null,
      lesson_occurrence_id: occurrenceId,
      body,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabase.from("attendance_notes").update(row).eq("id", existing.id);
      if (error) return { error: occurrenceNoteError(error) };
    } else {
      const { error } = await supabase.from("attendance_notes").insert(row);
      if (error) return { error: occurrenceNoteError(error) };
    }
    revalidatePath("/attendance");
    return { success: true };
  }

  const body = requireText(formData.get("body"), "הערה");
  if (isError(body)) return body;
  if (!studentId && !lessonId) return { error: "חסר הקשר להערה" };
  if (studentId && lessonId) return { error: "הערה כללית היא לתלמידה או לשיעור, לא לשניהם" };

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

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  let subjectId = String(formData.get("subject_id") ?? "").trim();
  if (!subjectId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("subject_id")
      .eq("id", lessonId)
      .maybeSingle();
    subjectId = lesson?.subject_id ?? "";
  }
  if (!subjectId) return { error: "לא נמצא מקצוע לשיעור שנבחר" };

  const { error } = await supabase.from("makeup_exams").upsert(
    {
      academic_year_id: yearId,
      student_id: studentId,
      lesson_id: lessonId,
      subject_id: subjectId,
      required_exams: required,
      status: "open",
    },
    { onConflict: "student_id,subject_id" }
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

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
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
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "completed" })
    .eq("id", occurrenceId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/");
  return { success: true };
}

export async function restoreOccurrenceAction(occurrenceId: string) {
  return restoreOccurrencesAction([occurrenceId]);
}

/** Reopen completed occurrences so attendance can be finished or corrected. Existing marks are kept. */
export async function restoreOccurrencesAction(occurrenceIds: string[]) {
  const ids = [...new Set(occurrenceIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return { error: "חסר מופע" };

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase
    .from("lesson_occurrences")
    .update({ status: "scheduled", gap_handling: null })
    .in("id", ids)
    .eq("status", "completed");
  if (error) return { error: "לא ניתן להחזיר את השיעור לעריכה" };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/");
  return { success: true };
}

/** Clear marks for these occurrences and return them to not-yet-filled. The lesson and the occurrence stay. */
export async function resetOccurrenceAttendanceAction(occurrenceIds: string[]) {
  const ids = [
    ...new Set(
      occurrenceIds
        .map((id) => requireUuid(id, "מופע"))
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  if (ids.length === 0) return { error: "חסר מופע" };

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: occs, error: loadError } = await supabase
    .from("lesson_occurrences")
    .select("id, status")
    .in("id", ids);
  if (loadError || !occs?.length) return { error: "לא נמצא המופע" };

  const resetIds = occs.filter((row) => row.status !== "cancelled").map((row) => row.id);
  if (resetIds.length === 0) {
    return { error: "שיעור שלא התקיים לא מתאפס מכאן. אפשר להחזירו ללוח." };
  }

  const { count: planned, error: countError } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .in("lesson_occurrence_id", resetIds);
  if (countError) return { error: "לא ניתן לאפס את הנוכחות" };

  const { error: deleteError, count: cleared } = await supabase
    .from("attendance")
    .delete({ count: "exact" })
    .in("lesson_occurrence_id", resetIds);
  if (deleteError) return { error: "לא ניתן לאפס את הנוכחות" };
  if (planned != null && cleared != null && cleared !== planned) {
    return { error: "לא כל הסימונים נמחקו. נסי שוב." };
  }

  const { error: statusError } = await supabase
    .from("lesson_occurrences")
    .update({ status: "scheduled", gap_handling: null })
    .in("id", resetIds);
  if (statusError) return { error: "הסימונים נמחקו, אבל לא ניתן לעדכן את מצב השיעור" };

  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/makeup");
  revalidatePath("/students", "layout");
  revalidatePath("/");
  return { success: true as const, cleared: cleared ?? planned ?? 0 };
}

/** Move these meetings to another lesson. Marks stay on the same occurrence ids and then count for the target. */
export async function reassignOccurrenceLessonAction(payload: {
  occurrenceIds: string[];
  targetLessonId: string;
}) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const targetLessonId = requireUuid(payload?.targetLessonId, "שיעור יעד");
  if (isError(targetLessonId)) return { error: "יש לבחור שיעור יעד מהרשימה" };

  const ids = [
    ...new Set(
      (payload?.occurrenceIds ?? [])
        .map((id) => requireUuid(id, "מופע"))
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  if (ids.length === 0) return { error: "חסר מופע" };

  const { data: occs, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, lesson_id, occurrence_date, lesson_number, status")
    .in("id", ids);
  if (occError) return { error: hebrewDbError(occError, "לא ניתן לקרוא את המופע") };
  if (!occs?.length || occs.length !== ids.length) {
    return { error: "לא נמצא המופע" };
  }
  if (occs.some((row) => row.status === "cancelled")) {
    return { error: "שיעור שלא התקיים לא מועבר מכאן" };
  }

  const sourceLessonIds = [...new Set(occs.map((row) => row.lesson_id))];
  const { data: sourceLessons, error: sourceError } = await supabase
    .from("lessons")
    .select("id, academic_year_id")
    .in("id", sourceLessonIds);
  if (sourceError || !sourceLessons?.length) {
    return { error: "לא ניתן לקרוא את השיעור של המופע" };
  }
  const yearIds = [...new Set(sourceLessons.map((row) => row.academic_year_id))];
  if (yearIds.length !== 1) {
    return { error: "אפשר להעביר רק מופעים מאותה שנה" };
  }
  const yearId = yearIds[0];

  const { data: target, error: targetError } = await supabase
    .from("lessons")
    .select("id, academic_year_id")
    .eq("id", targetLessonId)
    .maybeSingle();
  if (targetError || !target) return { error: "שיעור היעד לא נמצא" };
  if (target.academic_year_id !== yearId) {
    return { error: "שיעור היעד חייב להיות באותה שנה אקדמית" };
  }

  const toMove = occs.filter((row) => row.lesson_id !== targetLessonId);
  if (toMove.length === 0) {
    return { error: "המופע כבר שייך לשיעור הזה" };
  }

  const dates = [...new Set(toMove.map((row) => String(row.occurrence_date).slice(0, 10)))];
  const { data: existingTarget, error: existError } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, lesson_number")
    .eq("lesson_id", targetLessonId)
    .in("occurrence_date", dates);
  if (existError) {
    return {
      error: hebrewDbError(
        existError,
        "לא ניתן לבדוק אם לשיעור היעד כבר יש מפגש באותה שעה"
      ),
    };
  }

  const moveIdSet = new Set(toMove.map((row) => row.id));
  const wanted = new Set(
    toMove.map((row) => `${String(row.occurrence_date).slice(0, 10)}::${row.lesson_number}`)
  );
  const clashes = (existingTarget ?? []).filter((row) => {
    if (moveIdSet.has(row.id)) return false;
    return wanted.has(`${String(row.occurrence_date).slice(0, 10)}::${row.lesson_number}`);
  });
  if (clashes.length > 0) {
    const hours = [
      ...new Set(clashes.map((row) => formatLessonHours(row.lesson_number, 1))),
    ].join(", ");
    return {
      error: `לשיעור היעד כבר יש מפגש באותו תאריך ב${hours}. לא מעבירים כדי לא לדרוס.`,
    };
  }

  const toMoveIds = toMove.map((row) => row.id);
  const { data: updated, error: updateError } = await supabase
    .from("lesson_occurrences")
    .update({ lesson_id: targetLessonId })
    .in("id", toMoveIds)
    .select("id");
  if (updateError) {
    if (updateError.code === "23505") {
      return {
        error: "לשיעור היעד כבר יש מפגש באותו תאריך ובאותה שעה. לא מעבירים כדי לא לדרוס.",
      };
    }
    return { error: hebrewDbError(updateError, "העברת המופע נכשלה. לא נשמר.") };
  }
  if ((updated?.length ?? 0) !== toMoveIds.length) {
    return { error: "לא כל המופעים הועברו. נסי שוב." };
  }

  const marks: { student_id: string; lesson_occurrence_id: string }[] = [];
  for (const chunk of chunkIds(toMoveIds)) {
    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, lesson_occurrence_id")
      .in("lesson_occurrence_id", chunk);
    if (error) {
      return {
        error: hebrewDbError(
          error,
          "המופע הועבר, אבל לא ניתן לקרוא את הסימונים כדי לשייך תלמידות לשיעור היעד"
        ),
      };
    }
    marks.push(...(data ?? []));
  }

  const dateByOcc = new Map(
    toMove.map((row) => [row.id, String(row.occurrence_date).slice(0, 10)])
  );
  const studentDates = new Map<string, Set<string>>();
  for (const mark of marks) {
    const date = dateByOcc.get(mark.lesson_occurrence_id);
    if (!date || !mark.student_id) continue;
    const set = studentDates.get(mark.student_id) ?? new Set<string>();
    set.add(date);
    studentDates.set(mark.student_id, set);
  }

  let assigned = 0;
  const markedStudentIds = [...studentDates.keys()];
  if (markedStudentIds.length > 0) {
    type LinkRow = {
      id: string;
      student_id: string;
      start_date: string;
      end_date: string | null;
    };
    const existing: LinkRow[] = [];
    for (const chunk of chunkIds(markedStudentIds)) {
      const { data, error } = await supabase
        .from("student_lesson_assignments")
        .select("id, student_id, start_date, end_date")
        .eq("lesson_id", targetLessonId)
        .in("student_id", chunk);
      if (error) {
        return {
          error: hebrewDbError(
            error,
            "המופע הועבר, אבל לא ניתן לקרוא שיוכים לשיעור היעד"
          ),
        };
      }
      existing.push(...((data ?? []) as LinkRow[]));
    }

    const existingByStudent = new Map<string, LinkRow[]>();
    for (const row of existing) {
      const list = existingByStudent.get(row.student_id) ?? [];
      list.push(row);
      existingByStudent.set(row.student_id, list);
    }

    const toInsert: Array<{
      student_id: string;
      lesson_id: string;
      assignment_type: "manual";
      start_date: string;
      end_date: string;
    }> = [];
    for (const [studentId, dateSet] of studentDates) {
      const rows = existingByStudent.get(studentId) ?? [];
      for (const date of dateSet) {
        const covered = rows.some((row) => {
          const start = String(row.start_date).slice(0, 10);
          const end = row.end_date ? String(row.end_date).slice(0, 10) : "9999-12-31";
          return start <= date && date <= end;
        });
        if (!covered) {
          toInsert.push({
            student_id: studentId,
            lesson_id: targetLessonId,
            assignment_type: "manual",
            start_date: date,
            end_date: date,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("student_lesson_assignments")
        .insert(toInsert)
        .select("id");
      if (insertError) {
        return {
          error: hebrewDbError(
            insertError,
            "המופע הועבר, אבל לא כל התלמידות שסומנו שויכו לשיעור היעד"
          ),
        };
      }
      if ((inserted?.length ?? 0) !== toInsert.length) {
        return { error: "המופע הועבר, אבל לא כל השיוכים נשמרו" };
      }
      assigned = inserted.length;
    }

    for (const chunk of chunkIds(markedStudentIds)) {
      const { error: exclusionError } = await supabase
        .from("student_lesson_exclusions")
        .delete()
        .eq("lesson_id", targetLessonId)
        .in("student_id", chunk);
      if (
        exclusionError &&
        !/student_lesson_exclusions|schema cache|PGRST205|42P01/i.test(exclusionError.message)
      ) {
        return {
          error: hebrewDbError(
            exclusionError,
            "המופע הועבר, אבל לא ניתן לעדכן חריגה משיעור היעד"
          ),
        };
      }
    }
  }

  bustAttendanceShellCache();
  revalidatePath("/attendance");
  revalidatePath("/lessons");
  revalidatePath("/reports");
  revalidatePath("/students", "layout");
  return {
    success: true as const,
    lessonId: targetLessonId,
    occurrenceId: toMoveIds[0],
    assigned,
  };
}

/** Clear every non-cancelled meeting of one lesson. The lesson, meetings, and students stay. */
export async function resetLessonAttendanceAction(lessonId: string) {
  const id = requireUuid(lessonId, "שיעור");
  if (isError(id)) return { error: "השיעור לא זוהה" };

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const occs: { id: string; status: string }[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase
      .from("lesson_occurrences")
      .select("id, status")
      .eq("lesson_id", id)
      .range(from, from + 999);
    if (error) return { error: "לא ניתן לטעון את מפגשי השיעור" };
    const batch = data ?? [];
    occs.push(...batch);
    if (batch.length < 1000) break;
  }

  const resetIds = occs.filter((row) => row.status !== "cancelled").map((row) => row.id);
  if (resetIds.length === 0) {
    return { error: "אין מפגשים לאיפוס. שיעור שלא התקיים לא מתאפס מכאן." };
  }

  let planned = 0;
  let cleared = 0;
  for (const chunk of chunkIds(resetIds)) {
    const { count: chunkPlanned, error: countError } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .in("lesson_occurrence_id", chunk);
    if (countError) return { error: "לא ניתן לאפס את הנוכחות" };
    const { error: deleteError, count: chunkCleared } = await supabase
      .from("attendance")
      .delete({ count: "exact" })
      .in("lesson_occurrence_id", chunk);
    if (deleteError) return { error: "לא ניתן לאפס את הנוכחות" };
    if (chunkPlanned != null && chunkCleared != null && chunkCleared !== chunkPlanned) {
      return { error: "לא כל הסימונים נמחקו. נסי שוב." };
    }
    planned += chunkPlanned ?? 0;
    cleared += chunkCleared ?? 0;
  }

  for (const chunk of chunkIds(resetIds)) {
    const { data: updated, error: statusError } = await supabase
      .from("lesson_occurrences")
      .update({ status: "scheduled", gap_handling: null })
      .in("id", chunk)
      .select("id");
    if (statusError || (updated?.length ?? 0) !== chunk.length) {
      return { error: "הסימונים נמחקו, אבל לא ניתן לעדכן את מצב השיעור" };
    }
  }

  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/reports");
  revalidatePath("/makeup");
  revalidatePath("/students", "layout");
  revalidatePath("/");
  return { success: true as const, cleared };
}

// --- Attendance ---

const ATTENDANCE_WRITE_CHUNK = 200;

async function writeAttendanceRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  records: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: AttendanceStatus;
    reason: string | null;
  }>
): Promise<{ error: string } | { written: number }> {
  const seen = new Set<string>();
  const unique: typeof records = [];
  for (const row of records) {
    if (!row.student_id || !row.lesson_occurrence_id) continue;
    const key = `${row.student_id}::${row.lesson_occurrence_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  let written = 0;
  for (let i = 0; i < unique.length; i += ATTENDANCE_WRITE_CHUNK) {
    const chunk = unique.slice(i, i + ATTENDANCE_WRITE_CHUNK);
    const { error } = await supabase
      .from("attendance")
      .upsert(chunk, { onConflict: "student_id,lesson_occurrence_id" });
    if (error) return { error: "השמירה נכשלה" };
    written += chunk.length;
  }
  return { written };
}

async function tryMarkOccurrenceComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  occurrenceId: string
) {
  const { data: occ } = await supabase
    .from("lesson_occurrences")
    .select("lesson_id, occurrence_date, status")
    .eq("id", occurrenceId)
    .single();
  if (!occ || occ.status === "cancelled") return;

  const links = await fetchAllPages<{
    student_id: string;
    start_date: string;
    end_date: string | null;
    students: unknown;
  }>((from, to) =>
    supabase
      .from("student_lesson_assignments")
      .select("student_id, start_date, end_date, students(is_active)")
      .eq("lesson_id", occ.lesson_id)
      .range(from, to)
  );

  const studentIds = uniqueCoveredStudentIds(links, occ.occurrence_date);
  if (studentIds.length === 0) return;

  const markedPages = await Promise.all(
    chunkIds(studentIds).map((chunk) =>
      fetchAllPages<{ student_id: string }>((from, to) =>
        supabase
          .from("attendance")
          .select("student_id")
          .eq("lesson_occurrence_id", occurrenceId)
          .in("student_id", chunk)
          .range(from, to)
      )
    )
  );
  const marked = markedPages.flat();

  if (marked.length >= studentIds.length) {
    await supabase
      .from("lesson_occurrences")
      .update({ status: "completed", gap_handling: null })
      .eq("id", occurrenceId);
  }
}

export async function syncLessonStudentsAction(lessonId: string, academicYearId: string) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };

  try {
    const result = await autoAssignStudentsToLesson(lessonId, academicYearId, undefined, actionAuth.supabase);
    revalidatePath("/attendance");
    revalidatePath("/students");
    revalidatePath("/lessons");
    revalidatePath("/reports");
    return { success: true, assigned: result.assigned, backfilled: result.backfilled };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveAttendancePoolAction(input: {
  yearId: string;
  poolId?: string | null;
  name: string;
  lessonIds: string[];
}) {
  const yearId = requireId(input.yearId, "שנה");
  if (isError(yearId)) return yearId;
  const name = requireText(input.name, "שם הקיבוץ");
  if (isError(name)) return name;
  const lessonIds = [...new Set((input.lessonIds ?? []).filter(Boolean))];
  if (lessonIds.length < 2) {
    return { error: "יש לבחור לפחות שני שיעורים לאותה קבוצה" };
  }

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const { data: lessons, error: lessonError } = await supabase
    .from("lessons")
    .select("id, academic_year_id, grade_id, class_id, track_id, specialization_id, for_psychology")
    .in("id", lessonIds);
  if (lessonError) return { error: "לא ניתן לטעון את השיעורים שנבחרו" };
  if ((lessons ?? []).length !== lessonIds.length) {
    return { error: "חלק מהשיעורים שנבחרו לא נמצאו" };
  }
  if ((lessons ?? []).some((l) => l.academic_year_id !== yearId)) {
    return { error: "כל השיעורים חייבים להיות מאותה שנה אקדמית" };
  }

  const { data: audienceRows } = await supabase
    .from("lesson_audience")
    .select("lesson_id, grade_id, class_id, track_id, specialization_id")
    .in("lesson_id", lessonIds);
  const audienceMap = audienceMapFromRows(audienceRows ?? []);
  const fingerprints = (lessons ?? []).map((l) =>
    fingerprintForLesson(audienceForLesson(l, audienceMap), Boolean(l.for_psychology))
  );
  if (new Set(fingerprints).size > 1) {
    return { error: "אפשר לקבץ רק שיעורים של אותה קבוצה (אותן שכבות / כיתות / מסלולים / התמחויות)" };
  }

  const { data: taken } = await supabase
    .from("attendance_pool_members")
    .select("lesson_id, pool_id")
    .in("lesson_id", lessonIds);
  const conflict = (taken ?? []).find(
    (row) => !input.poolId || row.pool_id !== input.poolId
  );
  if (conflict) {
    return { error: "אחד השיעורים כבר שייך לקיבוץ נוכחות אחר" };
  }

  let poolId = input.poolId ?? null;
  if (poolId) {
    const { error } = await supabase
      .from("attendance_pools")
      .update({ name })
      .eq("id", poolId)
      .eq("academic_year_id", yearId);
    if (error) {
      if (error.message.includes("attendance_pools") && error.message.toLowerCase().includes("unique")) {
        return { error: "כבר קיים קיבוץ בשם זה בשנה הנוכחית" };
      }
      return { error: "שמירת הקיבוץ נכשלה" };
    }
    const { error: delError } = await supabase
      .from("attendance_pool_members")
      .delete()
      .eq("pool_id", poolId);
    if (delError) return { error: "עדכון השיעורים בקיבוץ נכשל" };
  } else {
    const { data: created, error } = await supabase
      .from("attendance_pools")
      .insert({ academic_year_id: yearId, name })
      .select("id")
      .single();
    if (error || !created) {
      if (error?.message.toLowerCase().includes("unique")) {
        return { error: "כבר קיים קיבוץ בשם זה בשנה הנוכחית" };
      }
      return { error: "יצירת הקיבוץ נכשלה. אם זו הפעם הראשונה — הריצי את 015_attendance_pools.sql" };
    }
    poolId = created.id;
  }

  const { error: memberError } = await supabase.from("attendance_pool_members").insert(
    lessonIds.map((lesson_id) => ({ pool_id: poolId, lesson_id }))
  );
  if (memberError) return { error: "צירוף השיעורים לקיבוץ נכשל" };

  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/students");
  revalidatePath("/reports");
  revalidatePath("/makeup");
  return { success: true };
}

export async function deleteAttendancePoolAction(poolId: string) {
  const id = requireId(poolId, "קיבוץ");
  if (isError(id)) return id;
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const { error } = await supabase.from("attendance_pools").delete().eq("id", id);
  if (error) return { error: "פירוק הקיבוץ נכשל" };
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/students");
  revalidatePath("/reports");
  revalidatePath("/makeup");
  return { success: true };
}

type AttendanceMarkInput = {
  studentId: string;
  occurrenceId: string;
  status: AttendanceStatus;
  reason?: string | null;
};

type AttendanceWritePayload = {
  updates: AttendanceMarkInput[];
  refresh?: boolean;
  skipPreviousWeek?: boolean;
};

export async function upsertAttendanceAction(
  studentId: string,
  occurrenceId: string,
  status: AttendanceStatus,
  reason?: string | null,
  options?: { refresh?: boolean; skipPreviousWeek?: boolean }
) {
  return bulkAttendanceAction({
    updates: [{ studentId, occurrenceId, status, reason }],
    refresh: options?.refresh,
    skipPreviousWeek: options?.skipPreviousWeek,
  });
}

export async function bulkAttendanceAction(
  input: AttendanceMarkInput[] | AttendanceWritePayload
) {
  const payload: AttendanceWritePayload = Array.isArray(input)
    ? { updates: input, refresh: true }
    : input;
  const updates = payload.updates ?? [];
  if (updates.length === 0) return { error: "אין סימונים לשמירה" };

  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const refresh = payload.refresh !== false;
  if (!payload.skipPreviousWeek) {
    const blocked = await previousWeekStartBlockMessage(
      supabase,
      updates.map((u) => u.occurrenceId)
    );
    if (blocked) return { error: blocked };
  }
  const records = updates.map((u) => ({
    student_id: u.studentId,
    lesson_occurrence_id: u.occurrenceId,
    status: u.status,
    reason: u.status === "absent" && u.reason ? u.reason : null,
  }));
  const written = await writeAttendanceRecords(supabase, records);
  if ("error" in written) return written;

  if (!refresh) {
    bustPendingAttendanceCache();
    return { success: true };
  }

  const occurrenceIds = [...new Set(updates.map((u) => u.occurrenceId))];
  await Promise.all(occurrenceIds.map((occId) => tryMarkOccurrenceComplete(supabase, occId)));

  revalidatePath("/attendance");
  return { success: true };
}

/** Mark every assigned student on these meetings. Roster comes from the database, not the screen list. */
export async function markOccurrenceRosterAction(payload: {
  occurrenceIds: string[];
  status: AttendanceStatus;
  onlyUnmarked?: boolean;
}) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const status = payload.status;
  if (status !== "present" && status !== "absent" && status !== "late") {
    return { error: "סטטוס לא תקין" };
  }
  const ids = [
    ...new Set(
      (payload.occurrenceIds ?? [])
        .map((id) => requireUuid(id, "מופע"))
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  if (ids.length === 0) return { error: "חסר מופע" };

  const { data: occs, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, lesson_id, occurrence_date, status")
    .in("id", ids);
  if (occError || !occs?.length) return { error: "לא נמצא המופע" };

  const records: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: AttendanceStatus;
    reason: string | null;
  }> = [];
  let planned = 0;

  for (const occ of occs) {
    if (occ.status === "cancelled") continue;
    const links = await fetchAllPages<{
      student_id: string;
      start_date: string;
      end_date: string | null;
      students: unknown;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("student_id, start_date, end_date, students(is_active)")
        .eq("lesson_id", occ.lesson_id)
        .range(from, to)
    );
    let studentIds = uniqueCoveredStudentIds(links, occ.occurrence_date);
    if (studentIds.length === 0) continue;

    if (payload.onlyUnmarked) {
      const already = new Set<string>();
      for (const chunk of chunkIds(studentIds)) {
        const rows = await fetchAllPages<{ student_id: string }>((from, to) =>
          supabase
            .from("attendance")
            .select("student_id")
            .eq("lesson_occurrence_id", occ.id)
            .in("student_id", chunk)
            .range(from, to)
        );
        for (const row of rows) already.add(row.student_id);
      }
      studentIds = studentIds.filter((id) => !already.has(id));
    }

    planned += studentIds.length;
    for (const studentId of studentIds) {
      records.push({
        student_id: studentId,
        lesson_occurrence_id: occ.id,
        status,
        reason: null,
      });
    }
  }

  if (records.length === 0) {
    return { success: true as const, planned: 0, written: 0 };
  }

  const written = await writeAttendanceRecords(supabase, records);
  if ("error" in written) return written;
  if (written.written !== records.length) {
    return { error: "לא כל הסימונים נשמרו. נסי שוב." };
  }

  await Promise.all(occs.map((occ) => tryMarkOccurrenceComplete(supabase, occ.id)));
  revalidatePath("/attendance");
  return { success: true as const, planned, written: written.written };
}

/**
 * Fill past attendance for one student+lesson so presence reaches 80% or 100%.
 * Keeps present/late; fills unmarked first (oldest→newest); then converts absent if needed.
 */
export async function fillAttendanceToTargetAction(
  studentId: string,
  lessonId: string,
  targetPercent: 80 | 100
) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  if (targetPercent !== 80 && targetPercent !== 100) {
    return { error: "יעד לא תקין" };
  }

  const { data: link } = await supabase
    .from("student_lesson_assignments")
    .select("start_date, end_date")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .is("end_date", null)
    .maybeSingle();

  const openLink = link;
  const { data: anyLink } =
    openLink
      ? { data: null }
      : await supabase
          .from("student_lesson_assignments")
          .select("start_date, end_date")
          .eq("student_id", studentId)
          .eq("lesson_id", lessonId)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

  const assignment = openLink ?? anyLink;
  if (!assignment) return { error: "התלמידה אינה משויכת לשיעור זה" };

  const today = todayIso();
  const { data: occurrences, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, occurrence_date, status")
    .eq("lesson_id", lessonId)
    .lte("occurrence_date", today)
    .neq("status", "cancelled")
    .gte("occurrence_date", assignment.start_date)
    .order("occurrence_date", { ascending: true });

  if (occError) return { error: "טעינת מופעים נכשלה" };

  const eligible = (occurrences ?? []).filter((o) => {
    if (assignment.end_date && o.occurrence_date > assignment.end_date) return false;
    return true;
  });

  if (eligible.length === 0) {
    return { error: "אין מופעי שיעור עד היום לסדר" };
  }

  const occIds = eligible.map((o) => o.id);
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("lesson_occurrence_id, status")
    .eq("student_id", studentId)
    .in("lesson_occurrence_id", occIds);

  const statusByOcc = new Map(
    (attendanceRows ?? []).map((r) => [r.lesson_occurrence_id, r.status as AttendanceStatus])
  );

  const alreadyPresent = eligible.filter((o) => {
    const s = statusByOcc.get(o.id);
    return s === "present" || s === "late";
  }).length;

  const targetPresent = Math.ceil((eligible.length * targetPercent) / 100);
  let need = Math.max(0, targetPresent - alreadyPresent);

  if (need === 0) {
    return {
      success: true,
      result: {
        total: eligible.length,
        alreadyPresent,
        marked: 0,
        convertedAbsent: 0,
        targetPercent,
        presencePercent: Math.round((alreadyPresent / eligible.length) * 100),
      },
    };
  }

  const unmarked = eligible.filter((o) => !statusByOcc.has(o.id));
  const absents = eligible.filter((o) => statusByOcc.get(o.id) === "absent");

  const updates: {
    studentId: string;
    occurrenceId: string;
    status: AttendanceStatus;
    reason?: null;
  }[] = [];

  for (const o of unmarked) {
    if (need <= 0) break;
    updates.push({ studentId, occurrenceId: o.id, status: "present", reason: null });
    need--;
  }

  let convertedAbsent = 0;
  for (const o of absents) {
    if (need <= 0) break;
    updates.push({ studentId, occurrenceId: o.id, status: "present", reason: null });
    convertedAbsent++;
    need--;
  }

  if (updates.length === 0) {
    return { error: "לא נמצאו מופעים למילוי" };
  }

  const records = updates.map((u) => ({
    student_id: u.studentId,
    lesson_occurrence_id: u.occurrenceId,
    status: u.status,
    reason: null as string | null,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(records, { onConflict: "student_id,lesson_occurrence_id" });
  if (error) return { error: error.message };

  for (const occId of [...new Set(updates.map((u) => u.occurrenceId))]) {
    await tryMarkOccurrenceComplete(supabase, occId);
  }

  const finalPresent = alreadyPresent + updates.length;
  revalidatePath("/attendance");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/");
  return {
    success: true,
    result: {
      total: eligible.length,
      alreadyPresent,
      marked: updates.length,
      convertedAbsent,
      targetPercent,
      presencePercent: Math.round((finalPresent / eligible.length) * 100),
    },
  };
}

function copiedAttendanceStatus(value: unknown): AttendanceStatus | null {
  if (value === "present" || value === "absent" || value === "late") return value;
  return null;
}

function copiedAbsenceReason(status: AttendanceStatus, value: unknown): string | null {
  if (status !== "absent") return null;
  if (value === "illness" || value === "permission" || value === "family" || value === "unexcused") {
    return value;
  }
  return null;
}

type PreviousAttendanceRow = {
  student_id: string;
  status: string;
  reason: string | null;
};

async function loadPreviousSameHourAttendance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  occurrenceDate: string,
  lessonNumber: number | null
): Promise<{ found: boolean; rows: PreviousAttendanceRow[] }> {
  let query = supabase
    .from("lesson_occurrences")
    .select("id")
    .eq("lesson_id", lessonId)
    .lt("occurrence_date", occurrenceDate)
    .neq("status", "cancelled")
    .order("occurrence_date", { ascending: false })
    .limit(1);
  if (lessonNumber != null) query = query.eq("lesson_number", lessonNumber);
  const { data: previous } = await query.maybeSingle();
  if (!previous) return { found: false, rows: [] };

  const rows = await fetchAllPages<PreviousAttendanceRow>((from, to) =>
    supabase
      .from("attendance")
      .select("student_id, status, reason")
      .eq("lesson_occurrence_id", previous.id)
      .range(from, to)
  );
  return { found: true, rows };
}

/** Copy each student's exact status from the previous same-hour meeting of the same lesson. */
export async function copyPreviousAttendanceAction(
  occurrenceId: string,
  alsoOccurrenceIds: string[] = []
) {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;

  const primaryId = requireUuid(occurrenceId, "מופע");
  if (isError(primaryId)) return primaryId;

  const targetIds = [
    ...new Set([
      primaryId,
      ...alsoOccurrenceIds
        .map((id) => requireUuid(id, "מופע"))
        .filter((id): id is string => typeof id === "string"),
    ]),
  ];

  const blocked = await previousWeekStartBlockMessage(supabase, targetIds);
  if (blocked) return { error: blocked };

  const { data: targets, error: occError } = await supabase
    .from("lesson_occurrences")
    .select("id, lesson_id, occurrence_date, lesson_number, status")
    .in("id", targetIds);
  if (occError) return { error: "לא ניתן לטעון את המופע" };
  if (!targets?.length) return { error: "מופע לא נמצא" };

  const byId = new Map(targets.map((row) => [row.id, row]));
  const primary = byId.get(primaryId);
  if (!primary) return { error: "מופע לא נמצא" };

  const prevCache = new Map<string, { found: boolean; rows: PreviousAttendanceRow[] }>();
  const records: Array<{
    student_id: string;
    lesson_occurrence_id: string;
    status: AttendanceStatus;
    reason: string | null;
  }> = [];
  const primaryRecords: Array<{
    student_id: string;
    status: AttendanceStatus;
    reason: string | null;
  }> = [];

  let primaryPreviousFound = false;
  let primaryPreviousHadRows = false;

  for (const targetId of targetIds) {
    const occ = byId.get(targetId);
    if (!occ || occ.status === "cancelled") continue;

    const cacheKey = `${occ.lesson_id}|${occ.occurrence_date}|${occ.lesson_number ?? ""}`;
    let previous = prevCache.get(cacheKey);
    if (!previous) {
      previous = await loadPreviousSameHourAttendance(
        supabase,
        occ.lesson_id,
        occ.occurrence_date,
        occ.lesson_number ?? null
      );
      prevCache.set(cacheKey, previous);
    }

    if (targetId === primaryId) {
      primaryPreviousFound = previous.found;
      primaryPreviousHadRows = previous.rows.length > 0;
    }
    if (!previous.found || previous.rows.length === 0) continue;

    const links = await fetchAllPages<{
      student_id: string;
      start_date: string;
      end_date: string | null;
      students: unknown;
    }>((from, to) =>
      supabase
        .from("student_lesson_assignments")
        .select("student_id, start_date, end_date, students(is_active)")
        .eq("lesson_id", occ.lesson_id)
        .range(from, to)
    );
    const eligible = new Set(uniqueCoveredStudentIds(links, occ.occurrence_date));

    for (const row of previous.rows) {
      if (!eligible.has(row.student_id)) continue;
      const status = copiedAttendanceStatus(row.status);
      if (!status) continue;
      const record = {
        student_id: row.student_id,
        lesson_occurrence_id: occ.id,
        status,
        reason: copiedAbsenceReason(status, row.reason),
      };
      records.push(record);
      if (targetId === primaryId) {
        primaryRecords.push({
          student_id: row.student_id,
          status,
          reason: record.reason,
        });
      }
    }
  }

  if (!primaryPreviousFound) return { error: "אין שיעור קודם להעתקה" };
  if (!primaryPreviousHadRows) return { error: "בשיעור הקודם אין רישומי נוכחות" };
  if (primaryRecords.length === 0 || records.length === 0) {
    return { error: "אין תלמידות משותפות להעתקה" };
  }

  const written = await writeAttendanceRecords(supabase, records);
  if ("error" in written) return written;
  if (written.written !== records.length) {
    return { error: "השמירה לא הושלמה לכל הרישומים" };
  }

  await Promise.all(targetIds.map((id) => tryMarkOccurrenceComplete(supabase, id)));
  revalidatePath("/attendance");

  return {
    success: true as const,
    copied: primaryRecords.length,
    written: written.written,
    present: primaryRecords.filter((row) => row.status === "present").length,
    late: primaryRecords.filter((row) => row.status === "late").length,
    absent: primaryRecords.filter((row) => row.status === "absent").length,
    records: primaryRecords,
  };
}

export async function downloadStudentImportTemplateAction() {
  const actionAuth = await createActionClient();
  if ("error" in actionAuth) return { error: actionAuth.error };
  const supabase = actionAuth.supabase;
  const activeYear = await getActiveAcademicYear();
  if (!activeYear) return { error: "יש להגדיר שנה אקדמית פעילה לפני הורדת הדוגמה." };

  const [{ data: grades }, { data: classes }, { data: tracks }, { data: specializations }] =
    await Promise.all([
      supabase.from("grades").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("classes")
        .select("id, name, grade_id")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase.from("tracks").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("specializations")
        .select("id, name")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
    ]);

  const bytes = buildStudentImportTemplate({
    grades: filterFixedGrades(grades ?? []),
    classes: classes ?? [],
    tracks: tracks ?? [],
    specializations: specializations ?? [],
  });
  return {
    filename: `students-import-template.xlsx`,
    base64: Buffer.from(bytes).toString("base64"),
  };
}

export async function importStudentsFromExcelAction(formData: FormData) {
  try {
    const actionAuth = await createActionClient();
    if ("error" in actionAuth) return { error: actionAuth.error };
    const supabase = actionAuth.supabase;
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) return { error: "יש להגדיר שנה אקדמית פעילה לפני ייבוא." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "יש לבחור קובץ אקסל או CSV." };
    }
    if (file.size > MAX_STUDENT_IMPORT_BYTES) {
      return { error: "הקובץ גדול מדי. הגודל המרבי הוא 3MB." };
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return { error: "יש להעלות קובץ בפורמט Excel (.xlsx) או CSV." };
    }

    const loaded = await loadStudentImportParse(supabase, file, activeYear.id);
    if (!loaded.parsed) return { error: loaded.error ?? "קריאת הקובץ נכשלה" };

    const parsed = loaded.parsed;
    if (parsed.errors.length > 0) {
      return {
        error: "הקובץ לא יובא. יש לתקן את כל השגיאות קודם — אף תלמידה לא נשמרה.",
        errors: parsed.errors,
        created: 0,
        updated: 0,
        unchanged: 0,
      };
    }
    if (parsed.rows.length === 0) {
      return {
        error: "לא נמצאו שורות תקינות לייבוא.",
        errors: parsed.errors,
        created: 0,
        updated: 0,
        unchanged: 0,
      };
    }

    const applied = await applyStudentImportRows(supabase, activeYear.id, parsed.rows);
    if (applied.errors.length > 0) {
      return {
        error: applied.errors[0]?.message ?? "הייבוא בוטל — אף תלמידה לא נשמרה.",
        errors: applied.errors,
        created: 0,
        updated: 0,
        unchanged: 0,
      };
    }

    revalidatePath("/students");
    revalidatePath("/attendance");
    return {
      success: true as const,
      created: applied.created,
      updated: applied.updated,
      unchanged: applied.unchanged,
      errors: [] as { rowNumber: number; message: string }[],
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "הייבוא נכשל",
      errors: [] as { rowNumber: number; message: string }[],
      created: 0,
      updated: 0,
      unchanged: 0,
    };
  }
}

export async function previewStudentsExcelAction(formData: FormData) {
  try {
    const actionAuth = await createActionClient();
    if ("error" in actionAuth) return { error: actionAuth.error };
    const supabase = actionAuth.supabase;
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) return { error: "יש להגדיר שנה אקדמית פעילה לפני ייבוא." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "יש לבחור קובץ אקסל או CSV." };
    }
    if (file.size > MAX_STUDENT_IMPORT_BYTES) {
      return { error: "הקובץ גדול מדי. הגודל המרבי הוא 3MB." };
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return { error: "יש להעלות קובץ בפורמט Excel (.xlsx) או CSV." };
    }

    const loaded = await loadStudentImportParse(supabase, file, activeYear.id);
    if (!loaded.parsed || !loaded.catalogs) {
      return { error: loaded.error ?? "קריאת הקובץ נכשלה" };
    }

    const catalogs = loaded.catalogs;
    const parsed = loaded.parsed;
    const classById = new Map(catalogs.classes.map((item) => [item.id, item.name]));
    const trackById = new Map(catalogs.tracks.map((item) => [item.id, item.name]));
    const specById = new Map(catalogs.specializations.map((item) => [item.id, item.name]));

    return {
      ok: parsed.errors.length === 0 && parsed.rows.length > 0,
      fileName: file.name,
      count: parsed.rows.length,
      errors: parsed.errors,
      rows: parsed.rows.map((row) => ({
        rowNumber: row.rowNumber,
        fullName: row.fullName,
        identityNumber: row.identityNumber,
        className: classById.get(row.classId) ?? "",
        trackName: trackById.get(row.trackId) ?? "",
        specializationName: specById.get(row.specializationId) ?? "",
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "בדיקת הקובץ נכשלה" };
  }
}

async function loadStudentImportParse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  yearId: string
): Promise<
  | { error: string; catalogs?: undefined; parsed?: undefined }
  | { error?: undefined; catalogs: StudentImportCatalogs; parsed: StudentImportParseResult }
> {
  const [{ data: grades }, { data: classes }, { data: tracks }, { data: specializations }] =
    await Promise.all([
      supabase.from("grades").select("id, name").eq("academic_year_id", yearId).order("name"),
      supabase
        .from("classes")
        .select("id, name, grade_id")
        .eq("academic_year_id", yearId)
        .order("name"),
      supabase.from("tracks").select("id, name").eq("academic_year_id", yearId).order("name"),
      supabase
        .from("specializations")
        .select("id, name")
        .eq("academic_year_id", yearId)
        .order("name"),
    ]);

  const catalogs = {
    grades: filterFixedGrades(grades ?? []),
    classes: classes ?? [],
    tracks: tracks ?? [],
    specializations: specializations ?? [],
  };
  if (
    catalogs.grades.length === 0 ||
    catalogs.classes.length === 0 ||
    catalogs.tracks.length === 0 ||
    catalogs.specializations.length === 0
  ) {
    return { error: "חסרות הגדרות בשנה הפעילה. יש להוסיף שכבה, כיתה, מסלול והתמחות לפני ייבוא." };
  }

  const parsed = parseStudentImportWorkbook(await file.arrayBuffer(), file.name, catalogs);
  return { catalogs, parsed };
}

