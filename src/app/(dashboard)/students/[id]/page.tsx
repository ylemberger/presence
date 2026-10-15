import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { PrintButton } from "@/components/ui/PrintButton";
import { SeminarPrintHeader } from "@/components/print/SeminarPrintHeader";
import { createClient, requireAuthenticatedUser } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { filterFixedGrades } from "@/lib/years/grades";
import { formatDate, isDateInRange } from "@/lib/dates/hebrew";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import {
  audienceForLesson,
  audienceMapFromRows,
  studentMatchesLesson,
} from "@/lib/lessons/autoAssign";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import { LeaveStudentButton } from "./LeaveStudentButton";
import { StudentDetailForms } from "./StudentDetailForms";
import { StudentLessonAssignments } from "./StudentLessonAssignments";
import { StudentPersonalNote } from "./StudentPersonalNote";
import { FillAttendanceTarget } from "./FillAttendanceTarget";
import type { AttendanceStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  WeeklyTimetableGrid,
  type TimetableEntry,
} from "@/components/timetable/WeeklyTimetableGrid";

interface Props {
  params: { id: string };
}

const PAGE_SIZE = 1000;

async function fetchPagedRows<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(error.message);
      break;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 50000) break;
  }
  return rows;
}

function chunkIds(ids: string[], size = 80): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

function embeddedName(
  value: { name?: string } | { name?: string }[] | null | undefined
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

export default async function StudentDetailPage({ params }: Props) {
  const { accessRole } = await requireAuthenticatedUser();
  if (accessRole === "viewer") redirect("/students");

  const { id } = params;
  const supabase = await createClient();
  const activeYear = await getActiveAcademicYear();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const { data: assignmentRows } = await supabase
    .from("student_assignments")
    .select(
      "id, academic_year_id, grade_id, class_id, track_id, specialization_id, secondary_specialization_id, start_date, end_date, is_psychology"
    )
    .eq("student_id", id)
    .order("start_date", { ascending: false });

  const yearIds = [...new Set((assignmentRows ?? []).map((a) => a.academic_year_id))];
  const gradeIds = [...new Set((assignmentRows ?? []).map((a) => a.grade_id).filter(Boolean))];
  const classIds = [...new Set((assignmentRows ?? []).map((a) => a.class_id).filter(Boolean))];
  const trackIds = [...new Set((assignmentRows ?? []).map((a) => a.track_id).filter(Boolean))];
  const specIds = [
    ...new Set(
      (assignmentRows ?? [])
        .flatMap((a) => [a.specialization_id, a.secondary_specialization_id])
        .filter((x): x is string => Boolean(x))
    ),
  ];

  const [
    { data: yearsForHistory },
    { data: gradesForHistory },
    { data: classesForHistory },
    { data: tracksForHistory },
    { data: specsForHistory },
  ] = await Promise.all([
    yearIds.length
      ? supabase.from("academic_years").select("id, name").in("id", yearIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    gradeIds.length
      ? supabase.from("grades").select("id, name").in("id", gradeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    classIds.length
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    trackIds.length
      ? supabase.from("tracks").select("id, name").in("id", trackIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    specIds.length
      ? supabase.from("specializations").select("id, name").in("id", specIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const yearNameById = new Map((yearsForHistory ?? []).map((y) => [y.id, y.name]));
  const gradeHistById = new Map((gradesForHistory ?? []).map((g) => [g.id, g.name]));
  const classHistById = new Map((classesForHistory ?? []).map((c) => [c.id, c.name]));
  const trackHistById = new Map((tracksForHistory ?? []).map((t) => [t.id, t.name]));
  const specHistById = new Map((specsForHistory ?? []).map((s) => [s.id, s.name]));

  const assignments = (assignmentRows ?? []).map((a) => ({
    id: a.id,
    academic_year_id: a.academic_year_id,
    start_date: a.start_date,
    end_date: a.end_date,
    yearName: yearNameById.get(a.academic_year_id) ?? "—",
    gradeName: gradeHistById.get(a.grade_id) ?? "—",
    className: classHistById.get(a.class_id) ?? "—",
    trackName: trackHistById.get(a.track_id) ?? "—",
    specializationName: a.specialization_id
      ? specHistById.get(a.specialization_id) ?? "—"
      : "—",
    secondarySpecializationName: a.secondary_specialization_id
      ? specHistById.get(a.secondary_specialization_id) ?? "—"
      : "—",
  }));

  let yearData = null;
  let lessons: Array<{
    id: string;
    subject: string;
    day_of_week?: number;
    lesson_number?: number;
    period_count?: number;
    billing_type?: string;
  }> = [];
  let weeklyTimetableEntries: TimetableEntry[] = [];
  let lessonAssignments: Array<{
    id: string;
    lesson_id: string;
    subject: string;
    assignment_type: string;
    start_date: string;
    end_date: string | null;
  }> = [];
  let subjectStats: Array<{
    unitKey: string;
    subject: string;
    lessonNames: string;
    totalRequired: number;
    absentCount: number;
    lateCount: number;
    presentOnlyCount: number;
    presentCount: number;
    unmarked: number;
    absencePercent: number;
    maxAllowed: number | null;
    ruleName: string | null;
    ruleLabel: string;
    ruleLevel: "ok" | "warning" | "blocked";
  }> = [];
  let changeLog: Array<{
    id: string;
    changed_at: string;
    old_status: string | null;
    new_status: string | null;
    subject: string;
    occurrence_date: string;
  }> = [];

  if (activeYear) {
    const [grades, classes, tracks, specializations, yearLessons, sla] = await Promise.all([
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("specializations").select("*").eq("academic_year_id", activeYear.id),
      supabase
        .from("lessons")
        .select(
          "id, subject, subject_id, day_of_week, lesson_number, period_count, billing_type, for_psychology, grade_id, class_id, track_id, specialization_id, attendance_rule_id, attendance_rules(name, max_allowed_absence_percent), subjects(name)"
        )
        .eq("academic_year_id", activeYear.id)
        .order("subject"),
      supabase
        .from("student_lesson_assignments")
        .select(
          "*, lessons!inner(" +
            "id, subject, academic_year_id, day_of_week, lesson_number, billing_type, for_psychology, " +
            "class_id, track_id, specialization_id, subjects(name), " +
            "teacher_teaching_assignments(teacher_id, teachers(full_name)), " +
            "classes(name), tracks(name), specializations(name)" +
          ")"
        )
        .eq("student_id", id)
        .eq("lessons.academic_year_id", activeYear.id)
        .order("start_date", { ascending: false }),
    ]);

    yearData = {
      year: activeYear,
      grades: filterFixedGrades(grades.data ?? []),
      classes: classes.data ?? [],
      tracks: tracks.data ?? [],
      specializations: specializations.data ?? [],
    };
    lessons = (yearLessons.data ?? []).map((l) => {
      const parent = Array.isArray(l.subjects)
        ? l.subjects[0]?.name
        : (l.subjects as { name?: string } | null)?.name;
      return {
        id: l.id,
        subject: formatSubjectLessonLabel(parent, l.subject),
        day_of_week: l.day_of_week,
        lesson_number: l.lesson_number,
        period_count: l.period_count,
        billing_type: l.billing_type,
      };
    });
    const slaRows = (sla.data ?? []) as unknown as Array<{
      id: string;
      lesson_id: string;
      assignment_type: string;
      start_date: string;
      end_date: string | null;
      lessons: {
        id: string;
        subject: string;
        subjects?: { name: string } | { name: string }[] | null;
        day_of_week: number;
        lesson_number: number;
        billing_type: string;
        for_psychology: boolean;
        classes: { name: string } | null;
        tracks: { name: string } | null;
        specializations: { name: string } | null;
        teacher_teaching_assignments: {
          teacher_id: string | null;
          teachers: { full_name: string } | null;
        } | null;
      };
    }>;
    lessonAssignments = slaRows.map((row) => ({
      id: row.id,
      lesson_id: row.lesson_id,
      subject: formatSubjectLessonLabel(
        (Array.isArray(row.lessons.subjects)
          ? row.lessons.subjects[0]?.name
          : row.lessons.subjects?.name) ?? null,
        row.lessons.subject
      ),
      assignment_type: row.assignment_type,
      start_date: row.start_date,
      end_date: row.end_date,
    }));

    weeklyTimetableEntries = slaRows.map((row) => {
      const l = row.lessons as any;
      const cls = l.classes as unknown as { name: string } | null;
      const tr = l.tracks as unknown as { name: string } | null;
      const spec = l.specializations as unknown as { name: string } | null;

      let audienceLabel = "—";
      if (l.billing_type === "specialization") audienceLabel = spec?.name ?? "—";
      else audienceLabel = cls?.name ?? tr?.name ?? "—";

      const teacherName = (l.teacher_teaching_assignments as any)?.teachers?.full_name ?? "";

      return {
        lessonId: l.id,
        subject: formatSubjectLessonLabel(
          (Array.isArray(l.subjects) ? l.subjects[0]?.name : l.subjects?.name) ?? null,
          l.subject
        ),
        teacherName,
        teacherId: (l.teacher_teaching_assignments as any)?.teacher_id ?? null,
        dayOfWeek: l.day_of_week,
        lessonNumber: l.lesson_number,
        billingType: l.billing_type,
        forPsychology: l.for_psychology,
        audienceLabel,
      } satisfies TimetableEntry;
    });

    const yearLessonRows = yearLessons.data ?? [];
    const yearLessonIds = yearLessonRows.map((l) => l.id as string);
    const yearPlacementRows = (assignmentRows ?? []).filter(
      (a) => a.academic_year_id === activeYear.id
    );
    const matchPlacement =
      yearPlacementRows.find((a) => a.end_date == null) ?? yearPlacementRows[0] ?? null;

    const [audienceRes, exclusionRes] = await Promise.all([
      yearLessonIds.length > 0
        ? supabase
            .from("lesson_audience")
            .select("lesson_id, grade_id, class_id, track_id, specialization_id")
            .in("lesson_id", yearLessonIds)
        : Promise.resolve({
            data: [] as {
              lesson_id: string;
              grade_id: string | null;
              class_id: string | null;
              track_id: string | null;
              specialization_id: string | null;
            }[],
          }),
      supabase.from("student_lesson_exclusions").select("lesson_id").eq("student_id", id),
    ]);
    const excludedLessonIds = new Set(
      ("error" in exclusionRes && exclusionRes.error
        ? []
        : exclusionRes.data ?? []
      ).map((row) => row.lesson_id)
    );
    const audienceByLesson = audienceMapFromRows(audienceRes.data ?? []);
    const assignedLessonIds = new Set<string>();
    for (const la of lessonAssignments) {
      if (!excludedLessonIds.has(la.lesson_id)) assignedLessonIds.add(la.lesson_id);
    }
    if (matchPlacement) {
      const placement = {
        class_id: matchPlacement.class_id,
        track_id: matchPlacement.track_id,
        specialization_id: matchPlacement.specialization_id,
        secondary_specialization_id: matchPlacement.secondary_specialization_id,
        grade_id: matchPlacement.grade_id,
        is_psychology: Boolean(matchPlacement.is_psychology),
      };
      for (const lesson of yearLessonRows) {
        const lessonId = lesson.id as string;
        if (excludedLessonIds.has(lessonId)) continue;
        const scoped = {
          id: lessonId,
          grade_id: (lesson.grade_id as string | null) ?? "",
          class_id: (lesson.class_id as string | null) ?? null,
          track_id: (lesson.track_id as string | null) ?? null,
          specialization_id: (lesson.specialization_id as string | null) ?? null,
          billing_type: String(lesson.billing_type ?? ""),
          for_psychology: Boolean(lesson.for_psychology),
          audience: audienceForLesson(
            {
              id: lessonId,
              grade_id: (lesson.grade_id as string | null) ?? null,
              class_id: (lesson.class_id as string | null) ?? null,
              track_id: (lesson.track_id as string | null) ?? null,
              specialization_id: (lesson.specialization_id as string | null) ?? null,
            },
            audienceByLesson
          ),
        };
        if (studentMatchesLesson(placement, scoped)) assignedLessonIds.add(lessonId);
      }
    }

    if (assignedLessonIds.size > 0) {
      const assignedIds = [...assignedLessonIds];
      const occSelect =
        "id, occurrence_date, status, lesson_id, lessons!inner(id, subject, subject_id, academic_year_id, attendance_rule_id, attendance_rules(name, max_allowed_absence_percent), subjects(name))";
      const [occurrenceChunks, attendanceRecords] = await Promise.all([
        Promise.all(
          chunkIds(assignedIds).map((ids) =>
            fetchPagedRows<{
              id: string;
              occurrence_date: string;
              status: string;
              lesson_id: string;
              lessons: unknown;
            }>((from, to) =>
              supabase
                .from("lesson_occurrences")
                .select(occSelect)
                .eq("lessons.academic_year_id", activeYear.id)
                .in("lesson_id", ids)
                .neq("status", "cancelled")
                .range(from, to)
            )
          )
        ),
        fetchPagedRows<{ id: string; lesson_occurrence_id: string; status: string }>(
          (from, to) =>
            supabase.from("attendance").select("id, lesson_occurrence_id, status").eq("student_id", id).range(from, to)
        ),
      ]);
      const occurrences = occurrenceChunks.flat();

      const yearAssignments = (assignments ?? []).filter(
        (a) => a.academic_year_id === activeYear.id
      );

      const byUnit = new Map<
        string,
        {
          name: string;
          lessonNames: Set<string>;
          rows: Array<{
            occurrenceId: string;
            occurrenceDate: string;
            status: string;
            attendanceStatus?: AttendanceStatus;
          }>;
          maxAllowed: number | null;
          ruleName: string | null;
        }
      >();

      const attendanceByOcc = new Map(
        attendanceRecords.map((a) => [a.lesson_occurrence_id, a.status as AttendanceStatus])
      );

      function ruleFromEmbedded(
        value: { name: string; max_allowed_absence_percent: number } | { name: string; max_allowed_absence_percent: number }[] | null | undefined
      ) {
        const rule = Array.isArray(value) ? value[0] : value;
        if (!rule || rule.max_allowed_absence_percent == null) {
          return { maxAllowed: null as number | null, ruleName: null as string | null };
        }
        return {
          maxAllowed: Number(rule.max_allowed_absence_percent),
          ruleName: rule.name ?? null,
        };
      }

      function ensureBucket(lessonId: string, occLesson?: {
        subject?: string;
        subjects?: { name: string } | { name: string }[] | null;
        attendance_rules?: { name: string; max_allowed_absence_percent: number } | null;
      }) {
        const catalog = yearLessonRows.find((l) => l.id === lessonId);
        const parentName =
          embeddedName(occLesson?.subjects) ??
          embeddedName(catalog?.subjects as { name?: string } | { name?: string }[] | null);
        const shortName = occLesson?.subject || String(catalog?.subject ?? "");
        const label = formatLessonOptionLabel({
          subject: shortName,
          subjectName: parentName,
          day_of_week: (catalog?.day_of_week as number | null) ?? null,
          lesson_number: (catalog?.lesson_number as number | null) ?? null,
          period_count: (catalog?.period_count as number | null) ?? 1,
          billing_type: (catalog?.billing_type as string | null) ?? null,
        });
        const fromOcc = ruleFromEmbedded(occLesson?.attendance_rules);
        const fromCatalog = ruleFromEmbedded(
          catalog?.attendance_rules as
            | { name: string; max_allowed_absence_percent: number }
            | { name: string; max_allowed_absence_percent: number }[]
            | null
        );
        const maxAllowed = fromOcc.maxAllowed ?? fromCatalog.maxAllowed;
        const ruleName = fromOcc.ruleName ?? fromCatalog.ruleName;
        const key = `lesson:${lessonId}`;
        const bucket = byUnit.get(key) ?? {
          name: label || "ללא",
          lessonNames: new Set<string>(),
          rows: [],
          maxAllowed: null,
          ruleName: null,
        };
        if (maxAllowed != null) {
          bucket.maxAllowed =
            bucket.maxAllowed == null ? maxAllowed : Math.min(bucket.maxAllowed, maxAllowed);
          bucket.ruleName = ruleName ?? bucket.ruleName;
        }
        byUnit.set(key, bucket);
        return bucket;
      }

      for (const lessonId of assignedIds) {
        ensureBucket(lessonId);
      }

      for (const o of occurrences) {
        if (!assignedLessonIds.has(o.lesson_id)) continue;
        const date = o.occurrence_date;
        const inPlacement = yearAssignments.some((a) =>
          isDateInRange(date, a.start_date, a.end_date)
        );
        if (!inPlacement) continue;

        const slaForLesson = lessonAssignments.filter((la) => la.lesson_id === o.lesson_id);
        const inLesson =
          slaForLesson.length === 0
            ? true
            : slaForLesson.some((la) => isDateInRange(date, la.start_date, la.end_date));
        if (!inLesson) continue;

        const lesson = o.lessons as {
          subject: string;
          subjects: { name: string } | { name: string }[] | null;
          attendance_rules: { name: string; max_allowed_absence_percent: number } | null;
        } | null;
        const bucket = ensureBucket(o.lesson_id, lesson ?? undefined);
        bucket.rows.push({
          occurrenceId: o.id,
          occurrenceDate: date,
          status: o.status,
          attendanceStatus: attendanceByOcc.get(o.id),
        });
      }

      subjectStats = Array.from(byUnit.entries()).map(([unitKey, bucket]) => {
        const summary = summarizeAttendance(bucket.rows);
        const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, bucket.maxAllowed);
        const extraLessons = [...bucket.lessonNames].filter((n) => n !== bucket.name);
        return {
          unitKey,
          subject: bucket.name,
          lessonNames: extraLessons.join(", "),
          ...summary,
          maxAllowed: bucket.maxAllowed,
          ruleName: bucket.ruleName,
          ruleLabel: evaluated.label,
          ruleLevel: evaluated.level,
        };
      }).sort((a, b) => a.subject.localeCompare(b.subject, "he"));

      const attendanceIds = (attendanceRecords ?? []).map((a) => a.id);
      if (attendanceIds.length > 0) {
        const { data: logs } = await supabase
          .from("attendance_change_log")
          .select("id, changed_at, old_status, new_status, attendance_id")
          .in("attendance_id", attendanceIds)
          .order("changed_at", { ascending: false })
          .limit(30);

        const occByAttendance = new Map(
          (attendanceRecords ?? []).map((a) => [a.id, a.lesson_occurrence_id])
        );
        const occMap = new Map(
          (occurrences ?? []).map((o) => [
            o.id,
            {
              subject: (o.lessons as unknown as { subject: string } | null)?.subject ?? "",
              date: o.occurrence_date,
            },
          ])
        );

        changeLog = (logs ?? []).map((log) => {
          const occId = occByAttendance.get(log.attendance_id);
          const occ = occId ? occMap.get(occId) : undefined;
          return {
            id: log.id,
            changed_at: log.changed_at,
            old_status: log.old_status,
            new_status: log.new_status,
            subject: occ?.subject ?? "",
            occurrence_date: occ?.date ?? "",
          };
        });
      }
    }
  }

  const displayName =
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    student.full_name;
  const initial =
    (student.first_name || student.full_name || "?").slice(0, 1) || "?";

  const currentAssignmentRow =
    (activeYear &&
      (assignmentRows ?? []).find(
        (a) => a.academic_year_id === activeYear.id && a.end_date == null
      )) ||
    (activeYear &&
      (assignmentRows ?? []).find((a) => a.academic_year_id === activeYear.id)) ||
    null;
  const currentPlacement = currentAssignmentRow
    ? {
        grade: gradeHistById.get(currentAssignmentRow.grade_id) ?? "—",
        className: classHistById.get(currentAssignmentRow.class_id) ?? "—",
        track: trackHistById.get(currentAssignmentRow.track_id) ?? "—",
        specialization: currentAssignmentRow.specialization_id
          ? specHistById.get(currentAssignmentRow.specialization_id) ?? "—"
          : "—",
        secondary: currentAssignmentRow.secondary_specialization_id
          ? specHistById.get(currentAssignmentRow.secondary_specialization_id) ?? "—"
          : "—",
        psychology: currentAssignmentRow.is_psychology,
      }
    : null;

  function detail(label: string, value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "" || value === "—") {
      return null;
    }
    return (
      <div className="min-w-0">
        <dt className="text-[10px] leading-none text-on-surface-variant">{label}</dt>
        <dd className="mt-0.5 break-words text-[12px] font-medium leading-snug text-on-surface">
          {String(value)}
        </dd>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      <SeminarPrintHeader
        title={displayName}
        subtitle={
          currentPlacement
            ? [
                currentPlacement.grade,
                currentPlacement.className,
                currentPlacement.track,
                currentPlacement.specialization !== "—"
                  ? currentPlacement.specialization
                  : null,
                activeYear?.name,
              ]
                .filter(Boolean)
                .join(" · ")
            : activeYear?.name
        }
      />
      <Link
        href="/students"
        className="print:hidden inline-flex w-fit items-center gap-1 font-label-md text-label-md text-primary hover:underline"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        חזרה לתלמידות
      </Link>
      {/* Student Header Profile Card — bento hero with top accent */}
      <section className="rounded-xl border border-outline-variant/30 border-t-4 border-t-secondary bg-surface-container-lowest p-4 shadow-tactile-md print:border print:p-3 print:shadow-none">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
          <div className="flex w-full min-w-0 flex-1 items-start gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-secondary-container text-[18px] font-bold text-primary print:hidden"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-md text-headline-md text-primary print:text-title-lg">
                  {displayName}
                </h2>
                <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      student.is_active ? "bg-attendance-present" : "bg-outline"
                    )}
                    aria-hidden
                  />
                  {student.is_active ? "פעילה" : "לא פעילה"}
                </span>
                {student.chetz_program && (
                  <span className="rounded-md bg-secondary-container px-2 py-0.5 text-caption font-semibold text-secondary">
                    תוכנית חץ
                  </span>
                )}
                {currentPlacement?.psychology && (
                  <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-caption font-semibold text-primary">
                    פסיכולוגיה
                  </span>
                )}
              </div>
              <StudentPersonalNote
                studentId={id}
                note={student.personal_note ?? null}
                compact
              />

              {currentPlacement && (
                <p className="mt-1 text-[12px] leading-snug text-on-surface-variant">
                  {[
                    `שכבה ${currentPlacement.grade}`,
                    currentPlacement.className,
                    currentPlacement.track,
                    currentPlacement.specialization !== "—"
                      ? currentPlacement.specialization
                      : null,
                    currentPlacement.secondary !== "—"
                      ? `+ ${currentPlacement.secondary}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {activeYear ? ` · ${activeYear.name}` : ""}
                </p>
              )}

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-5">
                {detail("מ.ז.", student.identity_number)}
                {detail("מחזור", student.cohort_number)}
                {detail("עיר", student.city)}
                {detail("כתובת", student.address)}
                {detail("ת.ל. לועזי", student.birth_date)}
                {detail("ת.ל. עברי", student.birth_date_hebrew)}
                {detail("טלפון", student.phone)}
                {detail("פל׳ אב", student.father_phone)}
                {detail("פל׳ אם", student.mother_phone)}
                {detail("פל׳ תלמידה", student.student_phone)}
                {detail("תיכון", student.high_school)}
              </dl>
            </div>
          </div>
          <div className="print:hidden flex flex-col items-stretch gap-2">
            <PrintButton documentTitle={`כרטיס-${displayName}`} />
            <LeaveStudentButton studentId={id} studentName={displayName} />
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-3">
        {/* Left column — wider tables */}
        <div className="flex flex-col gap-gutter xl:col-span-2">
          <Section icon="donut_large" title="אחוזי נוכחות" className="print:border-0 print:shadow-none">
            {subjectStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                <Icon name="insights" className="mb-2 block text-[36px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  אין שיעורים משויכים לתלמידה בשנה זו.
                </p>
              </div>
            ) : (
              <>
              <p className="mb-2 print:hidden font-caption text-caption text-on-surface-variant">
                כל שיעור שהתלמידה משויכת אליו מופיע בשורה נפרדת. כל שני איחורים = חיסור אחד; איחור בודד שנשאר נספר כנוכחות.
              </p>
              <Table
                compact
                headers={[
                  "שיעור",
                  "מופעים",
                  "נוכחת",
                  "איחור",
                  "נעדרה",
                  "אחוז היעדרות",
                  "סטטוס לפי כלל",
                ]}
              >
                {subjectStats.map((row) => (
                  <TableRow key={row.unitKey}>
                    <TableCell compact className="font-semibold text-primary">
                      <div>{row.subject}</div>
                      {row.lessonNames ? (
                        <div className="mt-0.5 font-caption text-caption font-normal text-on-surface-variant">
                          {row.lessonNames}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell compact className="text-on-surface-variant">
                      {row.totalRequired}
                    </TableCell>
                    <TableCell compact className="text-attendance-present">
                      {row.presentOnlyCount}
                    </TableCell>
                    <TableCell compact className="text-attendance-late">
                      {row.lateCount}
                    </TableCell>
                    <TableCell compact className="text-attendance-absent">
                      {row.absentCount}
                    </TableCell>
                    <TableCell compact
                      className={cn(
                        "font-bold",
                        row.ruleLevel === "blocked" && "text-attendance-absent",
                        row.ruleLevel === "warning" && "text-attendance-late",
                        row.ruleLevel === "ok" && "text-attendance-present"
                      )}
                    >
                      {row.absencePercent}%
                      {row.maxAllowed != null ? ` / ${row.maxAllowed}%` : ""}
                    </TableCell>
                    <TableCell compact>
                      <StatusPill
                        tone={
                          row.ruleLevel === "blocked"
                            ? "danger"
                            : row.ruleLevel === "warning"
                              ? "warn"
                              : "ok"
                        }
                      >
                        {row.ruleLabel}
                        {row.ruleName ? ` · ${row.ruleName}` : ""}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
              </>
            )}
          </Section>

          <Section icon="history" title="היסטוריית העברות" accent="none" className="print:hidden">
            <Table
              headers={[
                "שנה",
                "שכבה",
                "כיתה",
                "מסלול",
                "התמחות",
                "מתאריך",
                "עד תאריך",
              ]}
            >
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-primary">
                    {a.yearName}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {a.gradeName}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {a.className}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {a.trackName}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {a.specializationName}
                    {a.secondarySpecializationName !== "—"
                      ? ` + ${a.secondarySpecializationName}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {formatDate(a.start_date)}
                  </TableCell>
                  <TableCell>
                    {a.end_date ? (
                      <span className="text-on-surface-variant">
                        {formatDate(a.end_date)}
                      </span>
                    ) : (
                      <StatusPill tone="ok">נוכחי</StatusPill>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Section>

          {activeYear && weeklyTimetableEntries.length > 0 && (
            <Section
              icon="calendar_view_week"
              title="מערכת שעות שבועית"
              className="print:hidden"
              actions={
                <Link
                  href={`/timetable?studentId=${id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary-container px-4 py-2 font-label-md text-label-md text-primary shadow-tactile-sm transition-transform hover:-translate-y-0.5"
                >
                  <Icon name="open_in_new" className="text-[18px]" />
                  פתח בטבלת מערכת שעות
                </Link>
              }
              subtitle="מוצג לפי השיוך הפעיל של התלמידה לשיעורים."
            >
              <WeeklyTimetableGrid entries={weeklyTimetableEntries} />
            </Section>
          )}

          {activeYear && weeklyTimetableEntries.length === 0 && (
            <Section
              icon="calendar_view_week"
              title="מערכת שעות שבועית"
              className="print:hidden"
            >
              <p className="font-body-md text-body-md text-on-surface-variant">
                אין שיעורים פעילים לתלמידה בשנה הפעילה.
              </p>
            </Section>
          )}
        </div>

        {/* Right column — forms & smaller cards */}
        <div className="flex flex-col gap-gutter print:hidden">
          {yearData && (
            <Section
              icon="move_up"
              title="ביצוע העברה"
              accent="featured"
              className="print:hidden"
            >
              <StudentDetailForms studentId={id} yearData={yearData} />
            </Section>
          )}

          {activeYear && (
            <Section icon="menu_book" title="שיוך לשיעורים">
              <StudentLessonAssignments
                studentId={id}
                lessons={lessons}
                assignments={lessonAssignments}
              />
            </Section>
          )}

          {activeYear && (
            <Section
              icon="percent"
              title="סדר נוכחות לשיעור"
              className="print:hidden"
            >
              <FillAttendanceTarget
                studentId={id}
                lessons={lessons}
                assignments={lessonAssignments}
              />
            </Section>
          )}

          <Section icon="manage_history" title="יומן שינויי נוכחות">
            {changeLog.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                אין שינויים רשומים.
              </p>
            ) : (
              <ol className="relative flex flex-col gap-4 border-r-2 border-outline-variant/40 pr-4">
                {changeLog.slice(0, 8).map((log) => (
                  <li key={log.id} className="relative">
                    <span
                      className="absolute -right-[21px] top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-surface-container-lowest"
                      aria-hidden
                    />
                    <p className="font-label-md text-label-md text-primary">
                      {log.subject || "שיעור"} ·{" "}
                      {log.occurrence_date ? formatDate(log.occurrence_date) : "—"}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {formatDate(log.changed_at.slice(0, 10))} · {log.old_status ?? "—"} ←{" "}
                      {log.new_status ?? "—"}
                    </p>
                  </li>
                ))}
                {changeLog.length > 8 && (
                  <li className="relative">
                    <span
                      className="absolute -right-[21px] top-1 h-3 w-3 rounded-full bg-outline ring-4 ring-surface-container-lowest"
                      aria-hidden
                    />
                    <p className="font-caption text-caption text-on-surface-variant">
                      ועוד {changeLog.length - 8} שינויים…
                    </p>
                  </li>
                )}
              </ol>
            )}
          </Section>
        </div>
      </div>

    </div>
  );
}
