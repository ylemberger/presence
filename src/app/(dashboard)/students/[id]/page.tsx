import { notFound } from "next/navigation";
import Link from "next/link";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { PrintButton } from "@/components/ui/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { filterFixedGrades } from "@/lib/years/grades";
import { formatDate, isDateInRange } from "@/lib/dates/hebrew";
import { summarizeAttendance, evaluateAbsenceAgainstRule } from "@/lib/attendance/calculator";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
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

export default async function StudentDetailPage({ params }: Props) {
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
        .select("id, subject, subject_id, day_of_week, lesson_number, period_count, billing_type, subjects(name)")
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

    const lessonIds = lessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      const [{ data: occurrences }, { data: attendanceRecords }] = await Promise.all([
        supabase
          .from("lesson_occurrences")
          .select(
            "id, occurrence_date, status, lesson_id, lessons!inner(id, subject, subject_id, academic_year_id, attendance_rule_id, attendance_rules(name, max_allowed_absence_percent), subjects(name))"
          )
          .eq("lessons.academic_year_id", activeYear.id)
          .in("lesson_id", lessonIds)
          .neq("status", "cancelled"),
        supabase.from("attendance").select("*").eq("student_id", id),
      ]);

      const yearAssignments = (assignments ?? []).filter(
        (a) => a.academic_year_id === activeYear.id
      );

      const bySubject = new Map<
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

      for (const o of occurrences ?? []) {
        const date = o.occurrence_date;
        const inPlacement = yearAssignments.some((a) =>
          isDateInRange(date, a.start_date, a.end_date)
        );
        if (!inPlacement) continue;

        const hasLessonLinks = lessonAssignments.length > 0;
        const inLesson = !hasLessonLinks
          ? true
          : lessonAssignments.some(
              (la) =>
                la.lesson_id === o.lesson_id &&
                isDateInRange(date, la.start_date, la.end_date)
            );
        if (!inLesson) continue;

        const lesson = o.lessons as unknown as {
          subject: string;
          subject_id: string | null;
          subjects: { name: string } | { name: string }[] | null;
          attendance_rules: { name: string; max_allowed_absence_percent: number } | null;
        } | null;
        const parentName = Array.isArray(lesson?.subjects)
          ? lesson?.subjects[0]?.name
          : lesson?.subjects?.name;
        const key = lesson?.subject_id || `lesson:${o.lesson_id}`;
        const displayName = parentName?.trim() || lesson?.subject || "ללא";
        const rule = lesson?.attendance_rules ?? null;
        const maxAllowed =
          rule?.max_allowed_absence_percent != null
            ? Number(rule.max_allowed_absence_percent)
            : null;

        const bucket = bySubject.get(key) ?? {
          name: displayName,
          lessonNames: new Set<string>(),
          rows: [],
          maxAllowed: null,
          ruleName: null,
        };
        if (lesson?.subject) bucket.lessonNames.add(lesson.subject);
        bucket.rows.push({
          occurrenceId: o.id,
          occurrenceDate: date,
          status: o.status,
          attendanceStatus: attendanceRecords?.find((a) => a.lesson_occurrence_id === o.id)
            ?.status as AttendanceStatus | undefined,
        });
        if (maxAllowed != null) {
          bucket.maxAllowed =
            bucket.maxAllowed == null ? maxAllowed : Math.min(bucket.maxAllowed, maxAllowed);
          bucket.ruleName = rule?.name ?? bucket.ruleName;
        }
        bySubject.set(key, bucket);
      }

      subjectStats = Array.from(bySubject.entries()).map(([, bucket]) => {
        const summary = summarizeAttendance(bucket.rows);
        const evaluated = evaluateAbsenceAgainstRule(summary.absencePercent, bucket.maxAllowed);
        const extraLessons = [...bucket.lessonNames].filter((n) => n !== bucket.name);
        return {
          subject: bucket.name,
          lessonNames: extraLessons.join(", "),
          ...summary,
          maxAllowed: bucket.maxAllowed,
          ruleName: bucket.ruleName,
          ruleLabel: evaluated.label,
          ruleLevel: evaluated.level,
        };
      });

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
    const text =
      value === null || value === undefined || value === ""
        ? "—"
        : String(value);
    return (
      <div className="min-w-0">
        <dt className="font-caption text-caption text-on-surface-variant">{label}</dt>
        <dd className="mt-0.5 break-words font-body-md text-body-md text-on-surface">
          {text}
        </dd>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      {/* Student Header Profile Card — bento hero with top accent */}
      <section className="rounded-xl border border-outline-variant/30 border-t-4 border-t-secondary bg-surface-container-lowest p-6 shadow-tactile-md">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-start">
          <div className="flex w-full min-w-0 flex-1 items-start gap-6">
            <span
              aria-hidden
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-outline-variant bg-secondary-container font-headline-lg text-headline-lg font-bold text-primary"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-headline-lg text-headline-lg text-primary">
                  {displayName}
                </h2>
                <span className="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant">
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
                <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
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

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                {detail("מי", student.mi)}
                {detail("שם פרטי", student.first_name || null)}
                {detail("משפחה", student.last_name || null)}
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
                {detail("תוכנית חץ", student.chetz_program ? "כן" : "לא")}
                {currentPlacement && detail("שכבה", currentPlacement.grade)}
                {currentPlacement && detail("כיתה", currentPlacement.className)}
                {currentPlacement && detail("מסלול", currentPlacement.track)}
                {currentPlacement &&
                  detail("התמחות", currentPlacement.specialization)}
                {currentPlacement &&
                  detail("התמחות נוספת", currentPlacement.secondary)}
                {currentPlacement &&
                  detail("פסיכולוגיה", currentPlacement.psychology ? "כן" : "לא")}
              </dl>
            </div>
          </div>
          <PrintButton />
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-3">
        {/* Left column — wider tables */}
        <div className="flex flex-col gap-gutter xl:col-span-2">
          <Section icon="donut_large" title="אחוזי נוכחות לפי מקצוע">
            {subjectStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                <Icon name="insights" className="mb-2 block text-[36px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  אין נתוני נוכחות לחישוב עדיין.
                </p>
              </div>
            ) : (
              <Table
                headers={[
                  "מקצוע",
                  "שיעורים",
                  "נוכחת",
                  "איחור",
                  "נעדרה",
                  "אחוז היעדרות",
                  "סטטוס לפי כלל",
                ]}
              >
                {subjectStats.map((row) => (
                  <TableRow key={row.subject}>
                    <TableCell className="font-semibold text-primary">
                      <div>{row.subject}</div>
                      {row.lessonNames ? (
                        <div className="mt-0.5 font-caption text-caption font-normal text-on-surface-variant">
                          {row.lessonNames}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {row.totalRequired}
                    </TableCell>
                    <TableCell className="text-attendance-present">
                      {row.presentOnlyCount}
                    </TableCell>
                    <TableCell className="text-attendance-late">
                      {row.lateCount}
                    </TableCell>
                    <TableCell className="text-attendance-absent">
                      {row.absentCount}
                    </TableCell>
                    <TableCell
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
                    <TableCell>
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
            )}
          </Section>

          <Section icon="history" title="היסטוריית העברות" accent="none">
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
        <div className="flex flex-col gap-gutter">
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
