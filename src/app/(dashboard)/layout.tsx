import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeYear, years] = await Promise.all([
    getActiveAcademicYear(),
    getAllAcademicYears(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <Sidebar activeYearName={activeYear?.name} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-white/85 px-6 py-3.5 backdrop-blur-md sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted)]">
              מערכת ניהול פנימית
            </p>
            <p className="truncate text-sm text-slate-500">
              {activeYear ? `שנה פעילה · ${activeYear.name}` : "לא הוגדרה שנה פעילה"}
            </p>
          </div>
          <YearSelector years={years} activeYearId={activeYear?.id} />
        </header>
        <div className="flex-1 px-6 py-7 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
