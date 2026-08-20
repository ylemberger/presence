import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getActiveAcademicYear } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  let stats = { students: 0, teachers: 0, lessons: 0, occurrences: 0 };

  if (activeYear) {
    const [students, teachers, lessons, occurrences] = await Promise.all([
      supabase
        .from("student_assignments")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id),
      supabase
        .from("teacher_teaching_assignments")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id),
      supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", activeYear.id),
      supabase
        .from("lesson_occurrences")
        .select("*, lessons!inner(academic_year_id)", { count: "exact", head: true })
        .eq("lessons.academic_year_id", activeYear.id),
    ]);
    stats = {
      students: students.count ?? 0,
      teachers: teachers.count ?? 0,
      lessons: lessons.count ?? 0,
      occurrences: occurrences.count ?? 0,
    };
  }

  const cards = [
    { label: "תלמידות משובצות", value: stats.students, href: "/students" },
    { label: "מורות", value: stats.teachers, href: "/teachers" },
    { label: "שיעורים", value: stats.lessons, href: "/lessons" },
    { label: "מופעי שיעור", value: stats.occurrences, href: "/lessons" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">לוח בקרה</h1>
      {!activeYear ? (
        <Card>
          <p className="text-gray-600">
            לא הוגדרה שנה אקדמית פעילה.{" "}
            <Link href="/settings" className="text-blue-600 hover:underline">
              הגדר שנה אקדמית
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-6 text-gray-600">
            שנה פעילה: <strong>{activeYear.name}</strong>
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.label} href={card.href}>
                <Card className="transition-shadow hover:shadow-md">
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-blue-700">{card.value}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
