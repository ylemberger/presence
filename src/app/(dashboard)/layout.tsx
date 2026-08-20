import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
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
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar activeYearName={activeYear?.name} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden flex items-center justify-between border-b border-black/5 bg-white/80 px-8 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium tracking-wide text-[var(--brand-soft)]">
              מערכת ניהול פנימית
            </p>
            <p className="text-sm text-slate-500">
              {activeYear ? `שנה פעילה · ${activeYear.name}` : "לא הוגדרה שנה פעילה"}
            </p>
          </div>
          <YearSelector years={years} activeYearId={activeYear?.id} />
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
