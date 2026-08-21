import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getActiveAcademicYear } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  let stats = { students: 0, classes: 0, lessons: 0, unmarked: 0 };

  if (activeYear) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const start = weekStart.toISOString().split("T")[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const end = weekEnd.toISOString().split("T")[0];

    const [students, classes, lessons, occurrences] = await Promise.all([
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
    ]);

    const occIds = (occurrences.data ?? []).map((o) => o.id);
    let unmarked = occIds.length;
    if (occIds.length > 0) {
      const { data: marked } = await supabase
        .from("attendance")
        .select("lesson_occurrence_id")
        .in("lesson_occurrence_id", occIds);
      const withAny = new Set((marked ?? []).map((m) => m.lesson_occurrence_id));
      unmarked = occIds.filter((id) => !withAny.has(id)).length;
    }

    stats = {
      students: students.count ?? 0,
      classes: classes.count ?? 0,
      lessons: lessons.count ?? 0,
      unmarked,
    };
  }

  const cards = [
    { label: "תלמידות בשנה", value: stats.students, href: "/students", hint: "עם שיבוץ פעיל בשנה הזו" },
    { label: "כיתות", value: stats.classes, href: "/settings", hint: "מבנה השנה הפעילה" },
    { label: "תבניות שיעור", value: stats.lessons, href: "/lessons", hint: "שיעורים קבועים" },
    {
      label: "שיעורים בלי רישום",
      value: stats.unmarked,
      href: "/attendance",
      hint: "השבוע · לטיפול ביומן הנוכחות",
    },
  ];

  return (
    <div>
      <PageHeader
        title="לוח בקרה"
        description={
          activeYear
            ? `שנת ${activeYear.name} · התראות מופיעות במסך הרלוונטי (יומן נוכחות / תלמידה)`
            : "כדי להתחיל, הגדירי שנה אקדמית פעילה"
        }
        actions={
          <Link
            href="/attendance"
            className="inline-flex rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-soft)]"
          >
            ליומן נוכחות
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href}>
              <Card className="h-full transition-transform hover:-translate-y-0.5">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--brand)]">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
