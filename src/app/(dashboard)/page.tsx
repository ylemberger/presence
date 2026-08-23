import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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

export default async function DashboardPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();
  const today = todayIso();

  let stats = { students: 0, classes: 0, lessons: 0, unmarked: 0, markedThisWeek: 0 };
  let todayLessons: Array<{
    id: string;
    subject: string;
    teacherName: string;
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
             subject, academic_year_id, attendance_rule_id,
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
          teacher_teaching_assignments: { teachers: { full_name: string } | null } | null;
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
          marked,
          total,
        };
      });
    }

    // At-risk students this month (sample: active assignments + absences)
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

  const cards = [
    { label: "תלמידות בשנה", value: stats.students, href: "/students", hint: "עם שיבוץ פעיל" },
    { label: "כיתות", value: stats.classes, href: "/settings", hint: "מבנה השנה" },
    { label: "תבניות שיעור", value: stats.lessons, href: "/lessons", hint: "שיעורים קבועים" },
    {
      label: "שיעורים בלי רישום",
      value: stats.unmarked,
      href: `/attendance?date=${today}`,
      hint: "השבוע · לטיפול",
      alert: stats.unmarked > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="לוח בקרה"
        description={
          activeYear
            ? `שנת ${activeYear.name} · ${formatHebrewDate(today)}`
            : "כדי להתחיל, הגדירי שנה אקדמית פעילה"
        }
        actions={
          <Link
            href={`/attendance?date=${today}`}
            className="inline-flex items-center rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-soft)]"
          >
            סמני היום
          </Link>
        }
      />

      {!activeYear ? (
        <Card>
          <p className="text-slate-600">
            לא הוגדרה שנה אקדמית פעילה.{" "}
            <Link href="/settings" className="font-medium text-[var(--brand)] hover:underline">
              מעבר להגדרות
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <AttendanceReminderBanner summary={pendingSummary} />

          <div className="flex flex-wrap gap-2">
            {(
              [
                [`/attendance?date=${today}`, "סמני היום"],
                ["/reports?run=1", "דוח שבועי"],
                ["/students", "תלמידה חדשה"],
                ["/lessons", "שיעור חדש"],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-[var(--border-strong)]"
              >
                {label}
              </Link>
            ))}
          </div>

          {stats.markedThisWeek >= 5 && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              סמנת {stats.markedThisWeek} שיעורים השבוע — כל הכבוד!
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.label} href={card.href} className="group block">
                <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--border-strong)]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    {"alert" in card && card.alert ? (
                      <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-[var(--brand)]">
                    {card.value}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">{card.hint}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="שיעורי היום">
              {todayLessons.length === 0 ? (
                <p className="text-sm text-slate-500">אין שיעורים היום.</p>
              ) : (
                <ul className="space-y-2">
                  {todayLessons.map((lesson) => {
                    const done = lesson.total > 0 && lesson.marked >= lesson.total;
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/attendance?date=${today}&occurrenceId=${lesson.id}`}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-3 transition-colors",
                            done
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-stone-100 hover:bg-stone-50"
                          )}
                        >
                          <div>
                            <div className="font-medium text-slate-800">{lesson.subject}</div>
                            <div className="text-xs text-slate-500">{lesson.teacherName || "—"}</div>
                          </div>
                          <div className="text-left text-xs font-medium text-slate-600">
                            {done ? (
                              <span className="text-emerald-700">✓ הושלם</span>
                            ) : (
                              <>
                                {lesson.marked}/{lesson.total}
                                <span className="mr-2 text-[var(--brand)]">סמני ←</span>
                              </>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="תלמידות חורגות / קרובות לסף">
              {atRisk.length === 0 ? (
                <p className="text-sm text-slate-500">אין חריגות החודש — מעולה.</p>
              ) : (
                <ul className="space-y-2">
                  {atRisk.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/students/${s.id}`}
                        className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2.5 hover:bg-stone-50"
                      >
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            s.level === "blocked"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {s.percent}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
