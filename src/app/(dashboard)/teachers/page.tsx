import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { TeachersForms } from "./TeachersForms";
import { SyncButton } from "./SyncButton";

export default async function TeachersPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("full_name");

  const { data: sourceRecords } = await supabase
    .from("teacher_source_records")
    .select("*")
    .order("synced_at", { ascending: false });

  let assignments: Array<{
    id: string;
    subject: string;
    teachers: { full_name: string };
    classes: { name: string };
  }> = [];

  if (activeYear) {
    const { data } = await supabase
      .from("teacher_teaching_assignments")
      .select("id, subject, teachers(full_name), classes(name)")
      .eq("academic_year_id", activeYear.id);
    assignments = (data ?? []) as unknown as typeof assignments;
  }

  let classes: { id: string; name: string }[] = [];
  if (activeYear) {
    const { data } = await supabase
      .from("classes")
      .select("id, name")
      .eq("academic_year_id", activeYear.id);
    classes = data ?? [];
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">מורות</h1>
        {activeYear && <SyncButton academicYearId={activeYear.id} />}
      </div>

      <Card title="הוספת מורה מקומית">
        <TeachersForms type="teacher" classes={classes} yearId={activeYear?.id} />
      </Card>

      <Card title="רשימת מורות">
        <Table headers={["שם", 'ת"ז', "טלפון", "אימייל", "מקומית"]}>
          {(teachers ?? []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.full_name}</TableCell>
              <TableCell>{t.identity_number}</TableCell>
              <TableCell>{t.phone ?? "-"}</TableCell>
              <TableCell>{t.email ?? "-"}</TableCell>
              <TableCell>{t.is_local ? "כן" : "לא"}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>

      <Card title="שיבוצי הוראה">
        <TeachersForms
          type="assignment"
          teachers={teachers ?? []}
          classes={classes}
          yearId={activeYear?.id}
        />
        <Table headers={["מורה", "מקצוע", "כיתה"]} className="mt-4">
          {assignments.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.teachers?.full_name}</TableCell>
              <TableCell>{a.subject}</TableCell>
              <TableCell>{a.classes?.name}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>

      <Card title="מקור חיצוני (דמה)">
        <TeachersForms type="source" />
        <Table
          headers={["מזהה חיצוני", "שם", 'ת"ז', "מקצוע", "שנת מקור"]}
          className="mt-4"
        >
          {(sourceRecords ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.external_id}</TableCell>
              <TableCell>{r.full_name}</TableCell>
              <TableCell>{r.teacher_identity_number}</TableCell>
              <TableCell>{r.subject}</TableCell>
              <TableCell>{r.source_year}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}
