import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { StudentsForm } from "./StudentsForm";

export default async function StudentsPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("full_name");

  let assignments: Record<string, { className: string; gradeName: string }> = {};

  if (activeYear) {
    const { data: currentAssignments } = await supabase
      .from("student_assignments")
      .select("student_id, classes(name), grades(name)")
      .eq("academic_year_id", activeYear.id)
      .is("end_date", null);

    if (currentAssignments) {
      for (const a of currentAssignments) {
        assignments[a.student_id] = {
          className: (a.classes as unknown as { name: string } | null)?.name ?? "-",
          gradeName: (a.grades as unknown as { name: string } | null)?.name ?? "-",
        };
      }
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">תלמידות</h1>

      <Card title="הוספת תלמידה" className="mb-6">
        <StudentsForm />
      </Card>

      <Card title="רשימת תלמידות">
        <Table headers={["שם", 'ת"ז', "כיתה", "שכבה", "סטטוס", "פעולות"]}>
          {(students ?? []).map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.full_name}</TableCell>
              <TableCell>{s.identity_number}</TableCell>
              <TableCell>{assignments[s.id]?.className ?? "-"}</TableCell>
              <TableCell>{assignments[s.id]?.gradeName ?? "-"}</TableCell>
              <TableCell>{s.is_active ? "פעילה" : "לא פעילה"}</TableCell>
              <TableCell>
                <Link
                  href={`/students/${s.id}`}
                  className="text-blue-600 hover:underline"
                >
                  פרטים
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}
