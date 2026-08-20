import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { StudentDetailForms } from "./StudentDetailForms";

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

  const { data: assignments } = await supabase
    .from("student_assignments")
    .select("*, grades(name), classes(name), tracks(name), specializations(name), academic_years(name)")
    .eq("student_id", id)
    .order("start_date", { ascending: false });

  let yearData = null;
  if (activeYear) {
    const [grades, classes, tracks, specializations] = await Promise.all([
      supabase.from("grades").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("classes").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("tracks").select("*").eq("academic_year_id", activeYear.id),
      supabase.from("specializations").select("*").eq("academic_year_id", activeYear.id),
    ]);
    yearData = {
      year: activeYear,
      grades: grades.data ?? [],
      classes: classes.data ?? [],
      tracks: tracks.data ?? [],
      specializations: specializations.data ?? [],
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{student.full_name}</h1>
      <p className="text-gray-600">{"ת\"ז"}: {student.identity_number}</p>

      {yearData && (
        <Card title="שיבוץ / העברה">
          <StudentDetailForms studentId={id} yearData={yearData} />
        </Card>
      )}

      <Card title="היסטוריית שיבוצים">
        <Table
          headers={["שנה", "שכבה", "כיתה", "מגמה", "התמחות", "מתאריך", "עד תאריך"]}
        >
          {(assignments ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell>{(a.academic_years as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>{(a.grades as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>{(a.classes as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>{(a.tracks as unknown as { name: string } | null)?.name}</TableCell>
              <TableCell>
                {(a.specializations as unknown as { name: string } | null)?.name ?? "-"}
              </TableCell>
              <TableCell>{formatDate(a.start_date)}</TableCell>
              <TableCell>{a.end_date ? formatDate(a.end_date) : "נוכחי"}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}
