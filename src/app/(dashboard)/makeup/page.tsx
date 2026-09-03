import { PageHeader, StatusPill } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { getActiveAcademicYear } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  summarizeAttendance,
  evaluateMakeupRequirement,
  type MakeupTier,
} from "@/lib/attendance/calculator";
import { isDateInRange } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import { fetchAttendancePools, calcUnitForLesson } from "@/lib/attendance/pools";
import { MakeupForms } from "./MakeupForms";
import { MakeupFilters, type MakeupFilterStatus } from "./MakeupFilters";
import { Icon } from "@/components/ui/Icon";

interface Props {
  searchParams: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    status?: MakeupFilterStatus | string;
  };
}

export default async function MakeupPage({ searchParams }: Props) {
  const params = searchParams;
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title="מבחני השלמה"
          description="יש להגדיר שנה אקדמית פעילה."
          size="headline"
        />
      </div>
    );
  }

  const status: MakeupFilterStatus =
    params.status === "open" || params.status === "done" || params.status === "blocked"
      ? params.status
      : "all";

  const [
    { data: existing },
    { data: students },
    { data: classes },
    { data: tracks },
    { data: specializations },
    { data: teachers },
    { data: lessons },
    { data: placements },
    { data: lessonLinks },
    { data: occurrences },
    { data: attendance },
  ] = await Promise.all([
    supabase
      .from("makeup_exams")
      .select(
        "*, students(full_name), lessons(subject, subject_id, class_id, track_id, specialization_id, subjects(name), teacher_teaching_assignments(teacher_id, teachers(full_name)), attendance_rules(name, max_allowed_absence_percent))"
      )
      .eq("academic_year_id", activeYear.id)
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("classes")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase
      .from("tracks")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase
      .from("specializations")
      .select("id, name")
      .eq("academic_year_id", activeYear.id)
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    supabase
      .from("lessons")
      .select(
        "id, subject, subject_id, attendance_rule_id, attendance_rules(max_allowed_absence_percent), class_id, track_id, specialization_id, subjects(name), teacher_teaching_assignments(teacher_id, teachers(full_name))"
      )
      .eq("academic_year_id", activeYear.id)
      .order("subject"),
    supabase
      .from("student_assignments")
      .select("student_id, start_date, end_date")
      .eq("academic_year_id", activeYear.id),
    supabase
      .from("student_lesson_assignments")
      .select("student_id, lesson_id, start_date, end_date, lessons!inner(academic_year_id)")
      .eq("lessons.academic_year_id", activeYear.id)
      .is("end_date", null),
    supabase
      .from("lesson_occurrences")
      .select("id, occurrence_date, status, lesson_id, lessons!inner(academic_year_id)")
      .eq("lessons.academic_year_id", activeYear.id)
      .neq("status", "cancelled"),
    supabase.from("attendance").select("student_id, lesson_occurrence_id, status"),
  ]);

  const poolCatalog = await fetchAttendancePools(supabase, activeYear.id);

  function parentName(lesson: {
    subject: string;
    subjects?: unknown;
  }): string {
    const embedded = lesson.subjects as { name: string } | { name: string }[] | null | undefined;
    const name = Array.isArray(embedded) ? embedded[0]?.name : embedded?.name;
    return (name ?? "").trim() || lesson.subject;
  }

  const suggestions: Array<{
    studentId: string;
    studentName: string;
    lessonId: string;
    subject: string;
    classId: string | null;
    trackId: string | null;
    specializationId: string | null;
    teacherId: string | null;
    absencePercent: number;
    maxAllowed: number;
    requiredExams: number;
    tier: MakeupTier;
    label: string;
  }> = [];

  const existingKeys = new Set(
    (existing ?? []).map((e) => {
      const unit = calcUnitForLesson(e.lesson_id, poolCatalog.byLesson);
      return `${e.student_id}::${unit.key}`;
    })
  );
  const studentName = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const attendanceByStudent = new Map<string, typeof attendance>();
  for (const a of attendance ?? []) {
    const list = attendanceByStudent.get(a.student_id) ?? [];
    list.push(a);
    attendanceByStudent.set(a.student_id, list);
  }

  const groups = new Map<
    string,
    {
      studentId: string;
      unitKey: string;
      links: NonNullable<typeof lessonLinks>;
      lessonsInGroup: NonNullable<typeof lessons>;
    }
  >();
  for (const link of lessonLinks ?? []) {
    const lesson = (lessons ?? []).find((l) => l.id === link.lesson_id);
    if (!lesson) continue;
    const unit = calcUnitForLesson(lesson.id, poolCatalog.byLesson);
    const key = `${link.student_id}::${unit.key}`;
    const g = groups.get(key) ?? {
      studentId: link.student_id,
      unitKey: unit.key,
      links: [] as NonNullable<typeof lessonLinks>,
      lessonsInGroup: [] as NonNullable<typeof lessons>,
    };
    g.links.push(link);
    if (!g.lessonsInGroup.some((l) => l.id === lesson.id)) g.lessonsInGroup.push(lesson);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const percents = g.lessonsInGroup.map(
      (lesson) =>
        Number(
          (lesson.attendance_rules as unknown as { max_allowed_absence_percent: number } | null)
            ?.max_allowed_absence_percent
        ) || 20
    );
    const max = Math.min(...percents);
    const studentAtt = attendanceByStudent.get(g.studentId) ?? [];
    const studentPlacements = (placements ?? []).filter((p) => p.student_id === g.studentId);
    const lessonIds = new Set(g.lessonsInGroup.map((l) => l.id));
    const linkByLesson = new Map(g.links.map((link) => [link.lesson_id, link]));

    const eligible = (occurrences ?? [])
      .filter((o) => lessonIds.has(o.lesson_id))
      .filter((o) => {
        const date = o.occurrence_date;
        const inPlacement = studentPlacements.some((p) =>
          isDateInRange(date, p.start_date, p.end_date)
        );
        const link = linkByLesson.get(o.lesson_id);
        if (!link) return false;
        const inLesson = isDateInRange(date, link.start_date, link.end_date);
        return inPlacement && inLesson;
      })
      .map((o) => ({
        occurrenceId: o.id,
        occurrenceDate: o.occurrence_date,
        status: o.status,
        attendanceStatus: studentAtt.find((a) => a.lesson_occurrence_id === o.id)?.status as
          | AttendanceStatus
          | undefined,
      }));

    const summary = summarizeAttendance(eligible);
    if (summary.totalRequired === 0) continue;

    const makeup = evaluateMakeupRequirement(summary.absencePercent, max);
    if (makeup.tier === "none") continue;
    if (makeup.requiredExams === 0 && makeup.tier !== "blocked") continue;

    const key = `${g.studentId}::${g.unitKey}`;
    if (existingKeys.has(key)) continue;

    const lesson = g.lessonsInGroup[0];
    const unit = calcUnitForLesson(lesson.id, poolCatalog.byLesson);
    const names = g.lessonsInGroup.map((l) => parentName(l));
    suggestions.push({
      studentId: g.studentId,
      studentName: studentName.get(g.studentId) ?? "תלמידה",
      lessonId: lesson.id,
      subject: unit.poolName || [...new Set(names)].join(" · "),
      classId: (lesson as unknown as { class_id: string | null }).class_id ?? null,
      trackId: (lesson as unknown as { track_id: string | null }).track_id ?? null,
      specializationId: (lesson as unknown as { specialization_id: string | null }).specialization_id ?? null,
      teacherId:
        (lesson as unknown as {
          teacher_teaching_assignments: { teacher_id: string } | null;
        }).teacher_teaching_assignments?.teacher_id ?? null,
      absencePercent: summary.absencePercent,
      maxAllowed: max,
      requiredExams: makeup.requiredExams,
      tier: makeup.tier,
      label: makeup.label,
    });
  }

  suggestions.sort((a, b) => b.absencePercent - a.absencePercent);
  const blockedSuggestions = suggestions.filter((s) => s.tier === "blocked");
  const normalSuggestions = suggestions.filter((s) => s.tier !== "blocked");

  const subjects = [...new Set((lessons ?? []).map((l) => parentName(l)))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  function matchSuggestion(s: (typeof suggestions)[number]) {
    if (params.studentId && s.studentId !== params.studentId) return false;
    if (params.classId && s.classId !== params.classId) return false;
    if (params.trackId && s.trackId !== params.trackId) return false;
    if (params.specializationId && s.specializationId !== params.specializationId) return false;
    if (params.teacherId && s.teacherId !== params.teacherId) return false;
    if (params.subject && s.subject !== params.subject) return false;
    return true;
  }

  let filteredBlockedSuggestions = blockedSuggestions.filter(matchSuggestion);
  let filteredNormalSuggestions = normalSuggestions.filter(matchSuggestion);

  // status filter applies to suggestions as: open = tier1/2, blocked = tier blocked, done = none
  if (status === "blocked") {
    filteredNormalSuggestions = [];
  } else if (status === "open") {
    filteredBlockedSuggestions = [];
  } else if (status === "done") {
    filteredBlockedSuggestions = [];
    filteredNormalSuggestions = [];
  }

  const filteredExisting = (existing ?? []).filter((row: any) => {
    // status filter
    if (status === "open" && row.status !== "open") return false;
    if (status === "done" && row.status !== "done") return false;
    if (status === "blocked" && row.status !== "blocked") return false;

    const lesson = row.lessons as
      | {
          class_id?: string | null;
          track_id?: string | null;
          specialization_id?: string | null;
          subject?: string;
          subjects?: { name: string } | { name: string }[] | null;
          teacher_teaching_assignments?: { teacher_id?: string | null } | null;
        }
      | undefined;

    if (params.studentId && row.student_id !== params.studentId) return false;
    if (params.classId && (lesson?.class_id ?? null) !== params.classId) return false;
    if (params.trackId && (lesson?.track_id ?? null) !== params.trackId) return false;
    if (
      params.specializationId &&
      (lesson?.specialization_id ?? null) !== params.specializationId
    )
      return false;
    if (params.teacherId) {
      const teacherId = (lesson?.teacher_teaching_assignments as any)?.teacher_id ?? null;
      if (teacherId !== params.teacherId) return false;
    }
    if (params.subject) {
      const name = lesson ? parentName({ subject: lesson.subject ?? "", subjects: lesson.subjects }) : "";
      if (name !== params.subject && (lesson?.subject ?? "") !== params.subject) return false;
    }

    return true;
  });

  const totalFilteredSuggestions =
    filteredBlockedSuggestions.length + filteredNormalSuggestions.length;

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="ניהול מבחני השלמה"
        description="לפי אחוזי היעדרות מול כלל השיעור: מעל 20% → 1 מבחן, מעל 40% → 2 מבחנים, מעל 60% → חסומה (אין אפשרות להשלים)."
        size="headline"
      />

      <div className="print:hidden">
        <MakeupFilters
          classes={(classes ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
          tracks={(tracks ?? []).map((t: any) => ({ id: t.id, name: t.name }))}
          specializations={(specializations ?? []).map((s: any) => ({ id: s.id, name: s.name }))}
          teachers={(teachers ?? []).map((t: any) => ({ id: t.id, name: t.full_name }))}
          students={(students ?? []).map((s: any) => ({ id: s.id, full_name: s.full_name }))}
          subjects={subjects}
          defaults={{
            classId: params.classId,
            trackId: params.trackId,
            specializationId: params.specializationId,
            teacherId: params.teacherId,
            subject: params.subject,
            studentId: params.studentId,
            status,
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-3">
        {/* Left column — larger tables (existing exams + normal suggestions) */}
        <div className="flex flex-col gap-gutter xl:col-span-2">
          <Section icon="event_available" title="רשימת מבחני השלמה">
            {filteredExisting.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-8 text-center">
                <Icon name="fact_check" className="mb-2 block text-[36px] text-secondary" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  עדיין אין רשומות.
                </p>
              </div>
            ) : (
              <Table
                headers={["תלמידה", "שיעור", "נדרש", "הושלם", "סטטוס", "עדכון"]}
              >
                {filteredExisting.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-primary">
                      {(row.students as unknown as { full_name: string } | null)
                        ?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {row.lessons
                        ? parentName(row.lessons as { subject: string; subjects?: unknown })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {row.required_exams}
                    </TableCell>
                    <TableCell className="font-semibold text-attendance-present">
                      {row.completed_exams}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={
                          row.status === "done"
                            ? "ok"
                            : row.status === "blocked"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {row.status === "open"
                          ? "פתוח"
                          : row.status === "done"
                            ? "הושלם"
                            : "חסום"}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <MakeupForms
                        yearId={activeYear.id}
                        students={[]}
                        lessons={[]}
                        editId={row.id}
                        editDefaults={{
                          required_exams: row.required_exams,
                          completed_exams: row.completed_exams,
                          status: row.status,
                          notes: row.notes ?? "",
                        }}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </Section>

          {filteredBlockedSuggestions.length > 0 && (
            <Section icon="report" title="חסומות — מעל 60% היעדרות" accent="danger">
              <p className="mb-3 font-body-sm text-body-sm text-on-error-container">
                אין אפשרות להשלים — יש לפעול מול הצוות החינוכי.
              </p>
              <Table headers={["תלמידה", "שיעור", "היעדרות", "סף", "הערה"]}>
                {filteredBlockedSuggestions.slice(0, 20).map((s) => (
                  <TableRow key={`${s.studentId}-${s.lessonId}`}>
                    <TableCell className="font-semibold text-primary">
                      {s.studentName}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {s.subject}
                    </TableCell>
                    <TableCell className="font-bold text-attendance-absent">
                      {s.absencePercent}%
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {s.maxAllowed}%
                    </TableCell>
                    <TableCell>
                      <StatusPill tone="danger">{s.label}</StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            </Section>
          )}
        </div>

        {/* Right column — forms & suggestions */}
        <div className="flex flex-col gap-gutter">
          <Section icon="post_add" title="פתיחת מבחן השלמה" accent="featured">
            <MakeupForms
              yearId={activeYear.id}
              students={students ?? []}
              lessons={(lessons ?? []).map((l) => ({
                id: l.id,
                subject: formatSubjectLessonLabel(parentName(l), l.subject),
              }))}
            />
          </Section>

          <Section icon="warning" title="חריגות סף (הצעות)">
            {filteredNormalSuggestions.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                אין הצעות חדשות כרגע.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filteredNormalSuggestions.slice(0, 8).map((s) => {
                  const highRisk = s.absencePercent >= 40;
                  return (
                    <li
                      key={`${s.studentId}-${s.lessonId}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border p-3",
                        highRisk
                          ? "border-attendance-absent/20 bg-attendance-absent/5"
                          : "border-attendance-late/20 bg-attendance-late/5"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-label-md text-label-md text-on-surface">
                          {s.studentName}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {s.absencePercent}% חיסורים ב{s.subject} · {s.requiredExams}{" "}
                          מבחן/ים
                        </p>
                      </div>
                      <MakeupForms
                        yearId={activeYear.id}
                        students={[{ id: s.studentId, full_name: s.studentName }]}
                        lessons={[{ id: s.lessonId, subject: s.subject }]}
                        preset={{
                          studentId: s.studentId,
                          lessonId: s.lessonId,
                          requiredExams: s.requiredExams,
                        }}
                        compact
                      />
                    </li>
                  );
                })}
                {filteredNormalSuggestions.length > 8 && (
                  <li className="text-center font-caption text-caption text-on-surface-variant">
                    ועוד {filteredNormalSuggestions.length - 8} הצעות…
                  </li>
                )}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {totalFilteredSuggestions === 0 && filteredExisting.length === 0 && (
        <Section>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-6 py-10 text-center">
            <Icon name="check_circle" className="text-[36px] text-attendance-present" />
            <p className="font-title-lg text-title-lg text-primary">אין מבחני השלמה פעילים</p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              כל הכבוד! אין הצעות חדשות ולא רשומים מבחני השלמה.
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}
