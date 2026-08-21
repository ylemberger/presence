import { studentMatchesLesson } from "@/lib/lessons/autoAssign";
import { todayIso } from "@/lib/dates/hebrew";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DashboardAlert = {
  kind: "unreported" | "mismatch";
  title: string;
  detail: string;
  href: string;
};

export async function loadDashboardAlerts(
  supabase: Supabase,
  academicYearId: string
): Promise<DashboardAlert[]> {
  const today = todayIso();
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 14);
  const from = lookback.toISOString().split("T")[0];

  const [{ data: pastOccs }, { data: links }, { data: placements }] = await Promise.all([
    supabase
      .from("lesson_occurrences")
      .select(
        "id, occurrence_date, lessons!inner(id, subject, academic_year_id)"
      )
      .eq("lessons.academic_year_id", academicYearId)
      .gte("occurrence_date", from)
      .lt("occurrence_date", today)
      .neq("status", "cancelled")
      .order("occurrence_date", { ascending: false })
      .limit(80),
    supabase
      .from("student_lesson_assignments")
      .select(
        `
        id,
        student_id,
        lesson_id,
        students(full_name),
        lessons!inner(
          id,
          subject,
          grade_id,
          class_id,
          track_id,
          specialization_id,
          billing_type,
          academic_year_id
        )
      `
      )
      .eq("lessons.academic_year_id", academicYearId)
      .is("end_date", null)
      .limit(500),
    supabase
      .from("student_assignments")
      .select("student_id, grade_id, class_id, track_id, specialization_id")
      .eq("academic_year_id", academicYearId)
      .is("end_date", null),
  ]);

  const alerts: DashboardAlert[] = [];
  const occIds = (pastOccs ?? []).map((o) => o.id);

  if (occIds.length > 0) {
    const { data: marked } = await supabase
      .from("attendance")
      .select("lesson_occurrence_id")
      .in("lesson_occurrence_id", occIds);
    const withAny = new Set((marked ?? []).map((m) => m.lesson_occurrence_id));
    for (const o of pastOccs ?? []) {
      if (withAny.has(o.id)) continue;
      const subject =
        (o.lessons as unknown as { subject: string } | null)?.subject ?? "שיעור";
      alerts.push({
        kind: "unreported",
        title: "שיעור ללא הזנת נוכחות",
        detail: `${subject} · ${o.occurrence_date}`,
        href: `/attendance?mode=group&view=lesson&occurrenceId=${o.id}`,
      });
      if (alerts.filter((a) => a.kind === "unreported").length >= 8) break;
    }
  }

  const placementByStudent = new Map(
    (placements ?? []).map((p) => [
      p.student_id,
      {
        grade_id: p.grade_id,
        class_id: p.class_id,
        track_id: p.track_id,
        specialization_id: p.specialization_id,
      },
    ])
  );

  let mismatchCount = 0;
  for (const link of links ?? []) {
    const placement = placementByStudent.get(link.student_id);
    const lesson = link.lessons as unknown as {
      id: string;
      subject: string;
      grade_id: string;
      class_id: string | null;
      track_id: string | null;
      specialization_id: string | null;
      billing_type: string;
    } | null;
    if (!placement || !lesson) continue;
    if (studentMatchesLesson(placement, lesson)) continue;

    const studentName =
      (link.students as unknown as { full_name: string } | null)?.full_name ?? "תלמידה";
    alerts.push({
      kind: "mismatch",
      title: "שיוך שיעור שלא תואם שיבוץ",
      detail: `${studentName} · ${lesson.subject}`,
      href: `/students/${link.student_id}`,
    });
    mismatchCount++;
    if (mismatchCount >= 8) break;
  }

  return alerts;
}
