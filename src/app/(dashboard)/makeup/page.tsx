import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { getActiveAcademicYear } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  summarizeAttendance,
  evaluateMakeupRequirement,
  type MakeupTier,
} from "@/lib/attendance/calculator";
import { isDateInRange } from "@/lib/dates/hebrew";
import type { AttendanceStatus } from "@/types/database";
import { MakeupForms } from "./MakeupForms";
import { MakeupFilters, type MakeupFilterStatus } from "./MakeupFilters";

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
        <PageHeader title="מבחני השלמה" description="יש להגדיר שנה אקדמית פעילה." />
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
        "*, students(full_name), lessons(subject, class_id, track_id, specialization_id, teacher_teaching_assignments(teacher_id, teachers(full_name)), attendance_rules(name, max_allowed_absence_percent))"
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
        "id, subject, attendance_rule_id, attendance_rules(max_allowed_absence_percent), class_id, track_id, specialization_id, teacher_teaching_assignments(teacher_id, teachers(full_name))"
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
    (existing ?? []).map((e) => `${e.student_id}::${e.lesson_id}`)
  );
  const studentName = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const attendanceByStudent = new Map<string, typeof attendance>();
  for (const a of attendance ?? []) {
    const list = attendanceByStudent.get(a.student_id) ?? [];
    list.push(a);
    attendanceByStudent.set(a.student_id, list);
  }

  for (const link of lessonLinks ?? []) {
    const lesson = (lessons ?? []).find((l) => l.id === link.lesson_id);
    if (!lesson) continue;
    const max =
      Number(
        (lesson.attendance_rules as unknown as { max_allowed_absence_percent: number } | null)
          ?.max_allowed_absence_percent
      ) || 20;

    const studentAtt = attendanceByStudent.get(link.student_id) ?? [];
    const studentPlacements = (placements ?? []).filter((p) => p.student_id === link.student_id);
    const eligible = (occurrences ?? [])
      .filter((o) => o.lesson_id === link.lesson_id)
      .filter((o) => {
        const date = o.occurrence_date;
        const inPlacement = studentPlacements.some((p) =>
          isDateInRange(date, p.start_date, p.end_date)
        );
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

    const key = `${link.student_id}::${link.lesson_id}`;
    if (existingKeys.has(key)) continue;

    suggestions.push({
      studentId: link.student_id,
      studentName: studentName.get(link.student_id) ?? "תלמידה",
      lessonId: link.lesson_id,
      subject: lesson.subject,
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

  const subjects = [...new Set((lessons ?? []).map((l: any) => l.subject))].sort((a, b) =>
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
    if (params.subject && lesson?.subject !== params.subject) return false;

    return true;
  });

  const totalFilteredSuggestions =
    filteredBlockedSuggestions.length + filteredNormalSuggestions.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="מבחני השלמה"
        description="לפי אחוזי היעדרות מול כלל השיעור: מעל 20% → 1 מבחן, מעל 40% → 2 מבחנים, מעל 60% → חסומה (אין אפשרות להשלים)."
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

      <Card title="פתיחת מבחן השלמה">
        <MakeupForms
          yearId={activeYear.id}
          students={students ?? []}
          lessons={(lessons ?? []).map((l) => ({ id: l.id, subject: l.subject }))}
        />
      </Card>

      <Card title="הצעות לפי אחוזי היעדרות">
        {totalFilteredSuggestions === 0 ? (
          <p className="text-sm text-slate-500">אין הצעות חדשות כרגע.</p>
        ) : (
          <div className="space-y-4">
            {filteredBlockedSuggestions.length > 0 && (
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                <p className="mb-2 text-sm font-semibold text-rose-900">
                  חסומות (מעל 60%) — אין אפשרות להשלים
                </p>
                <Table headers={["תלמידה", "שיעור", "היעדרות", "סף", "הערה"]}>
                  {filteredBlockedSuggestions.slice(0, 20).map((s) => (
                    <TableRow key={`${s.studentId}-${s.lessonId}`}>
                      <TableCell>{s.studentName}</TableCell>
                      <TableCell>{s.subject}</TableCell>
                      <TableCell>{s.absencePercent}%</TableCell>
                      <TableCell>{s.maxAllowed}%</TableCell>
                      <TableCell>
                        <span className="font-bold text-rose-800">{s.label}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              </div>
            )}

            {filteredNormalSuggestions.length > 0 && (
              <Table headers={["תלמידה", "שיעור", "היעדרות", "סף", "מומלץ", ""]}>
                {filteredNormalSuggestions.slice(0, 40).map((s) => (
                  <TableRow key={`${s.studentId}-${s.lessonId}`}>
                    <TableCell>{s.studentName}</TableCell>
                    <TableCell>{s.subject}</TableCell>
                    <TableCell>{s.absencePercent}%</TableCell>
                    <TableCell>{s.maxAllowed}%</TableCell>
                    <TableCell>
                      {s.requiredExams} מבחן/ים · {s.label}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}
      </Card>

      <Card title="רשימת מבחני השלמה">
        {filteredExisting.length === 0 ? (
          <p className="text-sm text-slate-500">עדיין אין רשומות.</p>
        ) : (
          <Table headers={["תלמידה", "שיעור", "נדרש", "הושלם", "סטטוס", "עדכון"]}>
            {filteredExisting.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell>
                  {(row.students as unknown as { full_name: string } | null)?.full_name ?? "—"}
                </TableCell>
                <TableCell>
                  {(row.lessons as unknown as { subject: string } | null)?.subject ?? "—"}
                </TableCell>
                <TableCell>{row.required_exams}</TableCell>
                <TableCell>{row.completed_exams}</TableCell>
                <TableCell>
                  {row.status === "open"
                    ? "פתוח"
                    : row.status === "done"
                      ? "הושלם"
                      : "חסום"}
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
      </Card>
    </div>
  );
}
