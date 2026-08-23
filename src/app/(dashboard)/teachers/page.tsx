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
    for_psychology?: boolean;
    teachers: { full_name: string } | null;
    grades: { name: string } | null;
    classes: { name: string } | null;
    tracks: { name: string } | null;
    specializations: { name: string } | null;
  }> = [];

  if (activeYear) {
    const { data: asg } = await supabase
      .from("teacher_teaching_assignments")
      .select(
        "id, subject, billing_type, for_psychology, teachers(full_name), grades(name), classes(name), tracks(name), specializations(name)"
      )
      .eq("academic_year_id", activeYear.id)
      .order("subject");
    assignments = (asg ?? []) as unknown as typeof assignments;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="מורות"
        description="ניהול פרטי מורות. יצירת שיעורים — בלשונית שיעורים."
      />

      <Card title="הוספת מורה">
        <TeachersForms yearId={activeYear?.id} />
      </Card>

      <Card title="רשימת מורות">
        <TeachersDirectory teachers={teachers ?? []} />
      </Card>

      {activeYear && (
        <Card title="שיעורים לפי מורה (קריאה בלבד)">
          <p className="mb-3 text-sm text-slate-500">
            שיבוצי הוראה נוצרים אוטומטית בעת יצירת שיעור. ליצירה חדשה —{" "}
            <a href="/lessons" className="font-medium text-[var(--brand)] hover:underline">
              לשונית שיעורים
            </a>
            .
          </p>
          <Table headers={["מורה", "מקצוע", "סוג", "שכבה", "קהל יעד"]}>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.teachers?.full_name ?? "—"}</TableCell>
                <TableCell>{a.subject}</TableCell>
                <TableCell>
                  {a.for_psychology
                    ? "פסיכולוגיה"
                    : BILLING_TYPE_LABELS[a.billing_type] ?? a.billing_type}
                </TableCell>
                <TableCell>{a.grades?.name ?? "—"}</TableCell>
                <TableCell>
                  {a.for_psychology
                    ? "תלמידות פסיכולוגיה"
                    : [a.classes?.name, a.tracks?.name, a.specializations?.name]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </Table>
          {assignments.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">עדיין אין שיעורים בשנה זו.</p>
          )}
        </Card>
      )}
    </div>
  );
}
