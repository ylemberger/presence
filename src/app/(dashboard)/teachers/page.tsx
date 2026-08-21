import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import { TeachersForms } from "./TeachersForms";
import { TeachersDirectory } from "./TeachersDirectory";

export default async function TeachersPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: teachers } = await supabase.from("teachers").select("*").order("full_name");

  let assignments: Array<{
    id: string;
    subject: string;
    billing_type: "mandatory" | "specialization";
    teachers: { full_name: string } | null;
    grades: { name: string } | null;
    classes: { name: string } | null;
    tracks: { name: string } | null;
    specializations: { name: string } | null;
  }> = [];

  let grades: { id: string; name: string }[] = [];
  let classes: { id: string; name: string; grade_id: string }[] = [];
  let tracks: { id: string; name: string }[] = [];
  let specializations: { id: string; name: string }[] = [];

  if (activeYear) {
    const [asg, grd, cls, trk, spec] = await Promise.all([
      supabase
        .from("teacher_teaching_assignments")
        .select(
          "id, subject, billing_type, for_psychology, teachers(full_name), grades(name), classes(name), tracks(name), specializations(name)"
        )
        .eq("academic_year_id", activeYear.id)
        .order("subject"),
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
    assignments = (asg.data ?? []) as unknown as typeof assignments;
    grades = grd.data ?? [];
    classes = cls.data ?? [];
    tracks = trk.data ?? [];
    specializations = spec.data ?? [];
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="מורות"
        description="שיבוץ הוראה לפי שכבה + חובה (כיתה ו/או מסלול) או התמחות. כיתה+מסלול = רק מי שנמצאת בשניהם."
      />

      <Card title="הוספת מורה">
        <TeachersForms type="teacher" yearId={activeYear?.id} />
      </Card>

      <Card title="רשימת מורות">
        <TeachersDirectory teachers={teachers ?? []} />
      </Card>

      <Card title="שיבוצי הוראה">
        {!activeYear ? (
          <p className="text-sm text-slate-500">יש להגדיר שנה אקדמית פעילה.</p>
        ) : (
          <>
            <TeachersForms
              type="assignment"
              teachers={teachers ?? []}
              grades={grades}
              classes={classes}
              tracks={tracks}
              specializations={specializations}
              yearId={activeYear.id}
            />
            <Table
              headers={["מורה", "מקצוע", "סוג", "שכבה", "קהל יעד"]}
              className="mt-4"
            >
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.teachers?.full_name ?? "—"}</TableCell>
                  <TableCell>{a.subject}</TableCell>
                  <TableCell>
                    {(a as { for_psychology?: boolean }).for_psychology
                      ? "פסיכולוגיה"
                      : BILLING_TYPE_LABELS[a.billing_type] ?? a.billing_type}
                  </TableCell>
                  <TableCell>{a.grades?.name ?? "—"}</TableCell>
                  <TableCell>
                    {(a as { for_psychology?: boolean }).for_psychology
                      ? "תלמידות פסיכולוגיה"
                      : [a.classes?.name, a.tracks?.name, a.specializations?.name]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
            {assignments.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">עדיין אין שיבוצי הוראה בשנה זו.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
