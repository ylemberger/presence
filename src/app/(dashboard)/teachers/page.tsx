import { PageHeader } from "@/components/ui/PageHeader";
import { isViewerEmail } from "@/lib/auth/allowed-emails";
import { createClient, requireAuthenticatedUser } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { TeachersForms } from "./TeachersForms";
import { TeachersDirectory, type TeacherDirectoryRow } from "./TeachersDirectory";
import { TeachersLessons, type TeacherLessonRow } from "./TeachersLessons";
import { Icon } from "@/components/ui/Icon";
import { salaryDisplayFields } from "@/lib/teachers/salary-display";
import {
  fetchTeacherSourceRecords,
  groupSourceRowsByTeacher,
} from "@/lib/teachers/source-records";
import { embedOne } from "@/lib/supabase/embed";
import { teacherNameKey, uniqueTeachersByName } from "@/lib/teachers/name-group";

type AssignmentRow = {
  id: string;
  subject: string;
  billing_type: "mandatory" | "specialization";
  for_psychology?: boolean;
  teachers: { full_name: string } | null;
  grades: { name: string } | null;
  classes: { name: string } | null;
  tracks: { name: string } | null;
  specializations: { name: string } | null;
};

function uniqueJoined(values: Array<string | null | undefined>): string {
  const list = [
    ...new Set(
      values
        .map((v) => String(v ?? "").trim())
        .filter((v) => v && v !== "—")
    ),
  ];
  return list.length ? list.join(" · ") : "—";
}

function mergeLabels(values: string[]): string {
  return uniqueJoined(values.flatMap((value) => value.split(" · ")));
}

function sumMeetingLabels(labels: string[]): string {
  const numbers = labels.map((label) => Number(label)).filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return "—";
  return String(numbers.reduce((sum, n) => sum + n, 0));
}

export default async function TeachersPage() {
  const { user } = await requireAuthenticatedUser();
  const viewOnly = isViewerEmail(user.email);
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: teachers } = await supabase.from("teachers").select("*").order("full_name");

  const sourceRows = await fetchTeacherSourceRecords(supabase);

  const identityToTeacherId = new Map(
    (teachers ?? []).map((t) => [t.identity_number, t.id])
  );
  const sourcesByTeacher = groupSourceRowsByTeacher(sourceRows, identityToTeacherId);

  const flatRows: TeacherDirectoryRow[] = (teachers ?? []).map((t) => {
    const sources = sourcesByTeacher.get(t.id) ?? [];
    const fields = sources.map((s) => salaryDisplayFields(s));
    const meetings = fields
      .map((f) => f.meetings)
      .filter((n): n is number => typeof n === "number");
    return {
      id: t.id,
      full_name: t.full_name,
      identity_number: t.identity_number,
      phone: t.phone,
      email: t.email,
      is_local: t.is_local,
      salarySubjects: uniqueJoined(fields.map((f) => f.subject)),
      salaryTracks: uniqueJoined(fields.map((f) => f.track)),
      salaryGradeYears: uniqueJoined(fields.map((f) => f.year)),
      salarySemesters: uniqueJoined(fields.map((f) => f.semester)),
      salaryMeetings:
        meetings.length === 0
          ? "—"
          : String(meetings.reduce((a, b) => a + b, 0)),
    };
  });

  const membersByName = new Map<string, TeacherDirectoryRow[]>();
  for (const row of flatRows) {
    const key = teacherNameKey(row.full_name) || row.id;
    const list = membersByName.get(key) ?? [];
    list.push(row);
    membersByName.set(key, list);
  }

  const namedRows: TeacherDirectoryRow[] = uniqueTeachersByName(flatRows).map((option) => {
    const members = membersByName.get(teacherNameKey(option.name)) ?? [];
    const identity =
      members.find((member) => /\d{5,}/.test(member.identity_number))?.identity_number ??
      members[0]?.identity_number ??
      "";
    return {
      id: option.id,
      full_name: option.name,
      identity_number: identity,
      phone: members.find((member) => member.phone)?.phone ?? null,
      email: members.find((member) => member.email)?.email ?? null,
      is_local: members.length > 0 && members.every((member) => member.is_local),
      salarySubjects: mergeLabels(members.map((member) => member.salarySubjects)),
      salaryTracks: mergeLabels(members.map((member) => member.salaryTracks)),
      salaryGradeYears: mergeLabels(members.map((member) => member.salaryGradeYears)),
      salarySemesters: mergeLabels(members.map((member) => member.salarySemesters)),
      salaryMeetings: sumMeetingLabels(members.map((member) => member.salaryMeetings)),
    };
  });
  const directoryRows = [
    ...namedRows,
    ...flatRows.filter((row) => !teacherNameKey(row.full_name)),
  ];

  let lessonRows: TeacherLessonRow[] = [];

  if (activeYear) {
    const { data: asg } = await supabase
      .from("teacher_teaching_assignments")
      .select(
        "id, subject, billing_type, for_psychology, teachers(full_name), grades(name), classes(name), tracks(name), specializations(name)"
      )
      .eq("academic_year_id", activeYear.id)
      .order("subject");

    lessonRows = ((asg ?? []) as unknown as AssignmentRow[]).map((a) => ({
      id: a.id,
      teacherName: embedOne<{ full_name: string }>(a.teachers)?.full_name ?? "—",
      subject: a.subject,
      typeLabel: a.for_psychology
        ? "פסיכולוגיה"
        : BILLING_TYPE_LABELS[a.billing_type] ?? a.billing_type,
      grade: embedOne<{ name: string }>(a.grades)?.name ?? "—",
      audience: a.for_psychology
        ? "תלמידות פסיכולוגיה"
        : [
            embedOne<{ name: string }>(a.classes)?.name,
            embedOne<{ name: string }>(a.tracks)?.name,
            embedOne<{ name: string }>(a.specializations)?.name,
          ]
            .filter(Boolean)
            .join(" · ") || "—",
    }));
  }

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="מורות"
        description={
          viewOnly
            ? "צפייה ברשימת המורות. כל מורה פעם אחת. סנכרון מהשכר זמין רק למי שמנהלת את המערכת."
            : "מורות מגיעות ממערכת השכר, גם אם החוזה עדיין לא אושר. כל שם מופיע פעם אחת ברשימה."
        }
        size="display"
      />

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        {viewOnly ? null : (
        <div className="lg:col-span-4 lg:row-span-2">
          <section className="rounded-xl border-t-4 border-secondary bg-surface-container-lowest p-stack_md shadow-tactile-md">
            <h3 className="mb-4 flex items-center gap-2 font-title-lg text-title-lg text-primary">
              <Icon name="sync" className="text-secondary" />
              סנכרון מורות
            </h3>
            <TeachersForms />
          </section>
        </div>
        )}

        <div className={viewOnly ? "min-w-0 lg:col-span-12" : "min-w-0 lg:col-span-8"}>
          <TeachersDirectory teachers={directoryRows} viewOnly={viewOnly} />
        </div>

        {activeYear && (
          <div className={viewOnly ? "min-w-0 lg:col-span-12" : "min-w-0 lg:col-span-8"}>
            <TeachersLessons rows={lessonRows} viewOnly={viewOnly} />
          </div>
        )}
      </div>
    </div>
  );
}
