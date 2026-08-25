import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getActiveAcademicYear, getYearCatalog } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { todayIso, formatHebrewDate, addDays } from "@/lib/dates/hebrew";
import {
  evaluateAbsenceAgainstRule,
  summarizeAttendance,
} from "@/lib/attendance/calculator";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

const HEBREW_LESSON_LABEL = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'"] as const;

export default async function DashboardPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();
  const today = todayIso();

  let stats = { students: 0, classes: 0, lessons: 0, unmarked: 0, markedThisWeek: 0 };
  let todayLessons: Array<{
    id: string;
    subject: string;
    teacherName: string;
    className: string | null;
    lessonNumber: number | null;
    marked: number;
    total: number;
  }> = [];
  let atRisk: Array<{
    id: string;
    name: string;
    percent: number;
    level: "warning" | "blocked";
  }> = [];

  if (activeYear) {
    const catalog = await getYearCatalog(activeYear.id);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const start = weekStart.toISOString().split("T")[0];
    const end = addDays(start, 6);

    const [students, classes, lessons, weekOccs, todayOccsRaw] = await Promise.all([
      supabase
        .from("student_assignments")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id)
        .is("end_date", null),
      supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id),
      supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id),
      supabase
        .from("lesson_occurrences")
        .select("id, lessons!inner(academic_year_id)")
        .eq("lessons.academic_year_id", activeYear.id)
        .gte("occurrence_date", start)
        .lte("occurrence_date", end)
        .neq("status", "cancelled"),
      supabase
        .from("lesson_occurrences")
        .select(
          `id, lesson_id,
           lessons!inner(
             subject, academic_year_id, attendance_rule_id, class_id, lesson_number,
             classes(name),
             teacher_teaching_assignments(teachers(full_name))
           )`
        )
        .eq("lessons.academic_year_id", activeYear.id)
        .eq("occurrence_date", today)
        .neq("status", "cancelled"),
    ]);

    const weekOccIds = (weekOccs.data ?? []).map((o) => o.id);
    let unmarked = weekOccIds.length;
    let markedThisWeek = 0;
    if (weekOccIds.length > 0) {
      const { data: marked } = await supabase
        .from("attendance")
        .select("lesson_occurrence_id")
        .in("lesson_occurrence_id", weekOccIds);
      const withAny = new Set((marked ?? []).map((m) => m.lesson_occurrence_id));
      unmarked = weekOccIds.filter((id) => !withAny.has(id)).length;
      markedThisWeek = withAny.size;
    }

    const todayRows = todayOccsRaw.data ?? [];
    if (todayRows.length > 0) {
      const lessonIds = [...new Set(todayRows.map((o) => o.lesson_id))];
      const occIds = todayRows.map((o) => o.id);
      const [{ data: links }, { data: att }] = await Promise.all([
        supabase
          .from("student_lesson_assignments")
          .select("lesson_id, student_id, start_date, end_date, students(is_active)")
          .in("lesson_id", lessonIds),
        supabase.from("attendance").select("lesson_occurrence_id").in("lesson_occurrence_id", occIds),
      ]);

      todayLessons = todayRows.map((o) => {
        const lesson = o.lessons as unknown as {
          subject: string;
          lesson_number: number | null;
          teacher_teaching_assignments: { teachers: { full_name: string } | null } | null;
          classes: { name: string } | null;
        };
        let total = 0;
        for (const link of links ?? []) {
          if (link.lesson_id !== o.lesson_id) continue;
          if (!(link.students as unknown as { is_active: boolean } | null)?.is_active) continue;
          if (link.start_date > today) continue;
          if (link.end_date && link.end_date < today) continue;
          total++;
        }
        const marked = (att ?? []).filter((a) => a.lesson_occurrence_id === o.id).length;
        return {
          id: o.id,
          subject: lesson.subject,
          teacherName: lesson.teacher_teaching_assignments?.teachers?.full_name ?? "",
          className: lesson.classes?.name ?? null,
          lessonNumber: lesson.lesson_number ?? null,
          marked,
          total,
        };
      });

      todayLessons.sort((a, b) => (a.lessonNumber ?? 99) - (b.lessonNumber ?? 99));
    }

    const monthStart = `${today.slice(0, 8)}01`;
    const defaultRule = catalog.rules[0];
    const threshold = defaultRule ? Number(defaultRule.max_allowed_absence_percent) : 15;

    const { data: activeAssignments } = await supabase
      .from("student_assignments")
      .select("student_id, students(id, full_name, is_active)")
      .eq("academic_year_id", activeYear.id)
      .is("end_date", null)
      .limit(80);

    const studentIds = (activeAssignments ?? [])
      .map((a) => {
        const s = a.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
        return s?.is_active ? { id: s.id, name: s.full_name } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];

    if (studentIds.length > 0) {
      const ids = studentIds.map((s) => s.id);
      const [{ data: lessonLinks }, { data: occs }, { data: attRows }] = await Promise.all([
        supabase
          .from("student_lesson_assignments")
          .select("student_id, lesson_id, start_date, end_date, lessons!inner(academic_year_id)")
          .eq("lessons.academic_year_id", activeYear.id)
          .in("student_id", ids)
          .is("end_date", null),
        supabase
          .from("lesson_occurrences")
          .select("id, lesson_id, occurrence_date, status, lessons!inner(academic_year_id)")
          .eq("lessons.academic_year_id", activeYear.id)
          .gte("occurrence_date", monthStart)
          .lte("occurrence_date", today)
          .neq("status", "cancelled"),
        supabase.from("attendance").select("student_id, lesson_occurrence_id, status").in("student_id", ids),
      ]);

      const riskList: typeof atRisk = [];
      for (const st of studentIds) {
        const myLessons = new Set(
          (lessonLinks ?? []).filter((l) => l.student_id === st.id).map((l) => l.lesson_id)
        );
        const eligible = (occs ?? [])
          .filter((o) => myLessons.has(o.lesson_id))
          .map((o) => ({
            occurrenceId: o.id,
            occurrenceDate: o.occurrence_date,
            status: o.status,
            attendanceStatus: (attRows ?? []).find(
              (a) => a.student_id === st.id && a.lesson_occurrence_id === o.id
            )?.status as "present" | "absent" | "late" | undefined,
          }));
        if (eligible.length < 3) continue;
        const summary = summarizeAttendance(eligible);
        const ev = evaluateAbsenceAgainstRule(summary.absencePercent, threshold);
        if (ev.level === "warning" || ev.level === "blocked") {
          riskList.push({
            id: st.id,
            name: st.name,
            percent: summary.absencePercent,
            level: ev.level,
          });
        }
      }
      atRisk = riskList.sort((a, b) => b.percent - a.percent).slice(0, 5);
    }

    stats = {
      students: students.count ?? 0,
      classes: classes.count ?? 0,
      lessons: lessons.count ?? 0,
      unmarked,
      markedThisWeek,
    };
  }

  const pendingSummary = activeYear
    ? await getPendingAttendanceSummary(activeYear.id)
    : { pendingCount: 0, todayPending: 0, pastPending: 0, items: [] };

  const kpis = [
    {
      label: "תלמידות בשנה",
      value: stats.students,
      href: "/students",
      icon: "groups",
      accent: "secondary" as const,
    },
    {
      label: "כיתות",
      value: stats.classes,
      href: "/settings",
      icon: "class",
      accent: "outline" as const,
    },
    {
      label: "תבניות שיעור",
      value: stats.lessons,
      href: "/lessons",
      icon: "auto_awesome_mosaic",
      accent: "outline" as const,
    },
    {
      label: "שיעורים בלי רישום",
      value: stats.unmarked,
      href: `/attendance?date=${today}`,
      icon: "pending_actions",
      accent: "attendance-late" as const,
      alert: stats.unmarked > 0,
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display-lg text-display-lg text-primary">לוח בקרה</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {activeYear
              ? `שנת ${activeYear.name} · ${formatHebrewDate(today)}`
              : "כדי להתחיל, הגדירי שנה אקדמית פעילה"}
          </p>
        </div>
        <Link
          href={`/attendance?date=${today}`}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md text-white shadow-tactile-sm transition-colors hover:bg-primary-container hover:text-white"
        >
          <Icon name="fact_check" className="text-[20px]" />
          סמני היום
        </Link>
      </div>

      {!activeYear ? (
        <Card>
          <p className="text-on-surface-variant">
            לא הוגדרה שנה אקדמית פעילה.{" "}
            <Link href="/settings" className="font-medium text-primary hover:underline">
              מעבר להגדרות
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <AttendanceReminderBanner summary={pendingSummary} />

          {/* Quick Actions & KPI Grid */}
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12">
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    [`/attendance?date=${today}`, "סמני היום", "check_circle"],
                    ["/reports?run=1", "דוח שבועי", "bar_chart"],
                    ["/students", "תלמידה חדשה", "person_add"],
                    ["/lessons", "שיעור חדש", "add_box"],
                  ] as const
                ).map(([href, label, icon]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2.5 text-label-md text-primary shadow-tactile-sm transition-colors hover:bg-surface-container-low"
                  >
                    <Icon name={icon} className="text-[18px]" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="col-span-12 grid grid-cols-2 gap-gutter md:grid-cols-4">
              {kpis.map((kpi) => (
                <Link key={kpi.label} href={kpi.href} className="group block">
                  <Card
                    accent={kpi.accent}
                    className={cn(
                      "card-hover relative flex h-full flex-col justify-between p-6",
                      kpi.alert && "overflow-hidden"
                    )}
                  >
                    {kpi.alert && (
                      <div
                        className="dot-warning absolute left-4 top-4 h-3 w-3 rounded-full bg-attendance-late"
                        aria-hidden
                      />
                    )}
                    <p className="mb-4 font-body-md text-body-md text-on-surface-variant">
                      {kpi.label}
                    </p>
                    <div className="flex items-end justify-between">
                      <span className="font-headline-lg text-headline-lg text-primary">
                        {kpi.value}
                      </span>
                      <Icon
                        name={kpi.icon}
                        className={cn(
                          "text-3xl",
                          kpi.alert ? "text-attendance-late/40" : "text-outline-variant"
                        )}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {stats.markedThisWeek >= 5 && (
            <div className="rounded-xl bg-attendance-present/10 px-4 py-3 text-caption font-semibold text-attendance-present">
              סמנת {stats.markedThisWeek} שיעורים השבוע — כל הכבוד!
            </div>
          )}

          {/* Two Column: Today lessons + At-risk */}
          <div className="grid flex-1 grid-cols-12 gap-gutter">
            {/* Today lessons */}
            <div className="col-span-12 flex flex-col rounded-xl bg-surface-container-lowest p-6 shadow-tactile-md lg:col-span-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="inline-block border-b-2 border-secondary pb-1 font-title-lg text-title-lg text-primary">
                  שיעורי היום
                </h3>
                <Link
                  href="/timetable"
                  className="text-label-md text-secondary hover:underline"
                >
                  צפייה במערכת השעות
                </Link>
              </div>

              {todayLessons.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">אין שיעורים היום.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {todayLessons.map((lesson) => {
                    const done = lesson.total > 0 && lesson.marked >= lesson.total;
                    const progress =
                      lesson.total > 0 ? Math.round((lesson.marked / lesson.total) * 100) : 0;
                    const label = HEBREW_LESSON_LABEL[(lesson.lessonNumber ?? 1) - 1] ?? "?";
                    return (
                      <Link
                        key={lesson.id}
                        href={`/attendance?date=${today}&occurrenceId=${lesson.id}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/30 bg-background p-4 transition-colors hover:bg-[var(--accent-soft)]"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-bold",
                              done
                                ? "bg-primary-container text-white"
                                : "bg-surface-variant text-on-surface-variant"
                            )}
                            aria-hidden
                          >
                            {label}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate font-label-md text-label-md text-primary">
                              {lesson.subject}
                            </h4>
                            <p className="text-caption text-on-surface-variant">
                              {lesson.teacherName || "—"}
                              {lesson.className ? ` • ${lesson.className}` : ""}
                            </p>
                          </div>
                        </div>
                        {done ? (
                          <span className="status-pill-ok flex items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold">
                            <Icon name="check" className="text-[16px]" />
                            הושלם
                          </span>
                        ) : lesson.marked > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-caption text-on-surface-variant">
                              {lesson.marked}/{lesson.total}
                            </span>
                            <div
                              className="h-2.5 w-32 overflow-hidden rounded-full bg-surface-variant"
                              aria-hidden
                            >
                              <div
                                className="h-2.5 rounded-full bg-attendance-late"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="rounded border border-secondary px-3 py-1 text-label-md text-secondary transition-colors hover:bg-secondary/10">
                            סמני נוכחות
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* At-risk students */}
            <div className="col-span-12 flex flex-col rounded-xl bg-surface-container-lowest p-6 shadow-tactile-md lg:col-span-4">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="inline-block border-b-2 border-attendance-absent pb-1 font-title-lg text-title-lg text-primary">
                  תלמידות חורגות
                </h3>
              </div>
              {atRisk.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">
                  אין חריגות החודש — מעולה.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {atRisk.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0"
                    >
                      <Link
                        href={`/students/${s.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
                          aria-hidden
                        >
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-label-md text-label-md text-primary">
                          {s.name}
                        </span>
                      </Link>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          s.level === "blocked"
                            ? "status-pill-blocked"
                            : "status-pill-warning"
                        )}
                      >
                        {s.percent}% היעדרות
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/reports"
                className="mt-4 block w-full rounded-md bg-surface-container-low py-2 text-center text-label-md text-on-surface-variant transition-colors hover:text-primary"
              >
                צפייה בדוח מלא
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
