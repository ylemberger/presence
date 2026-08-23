import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser();

  const [activeYear, years] = await Promise.all([
    getActiveAcademicYear(),
    getAllAcademicYears(),
  ]);

  const pending = activeYear
    ? await getPendingAttendanceSummary(activeYear.id)
    : { pendingCount: 0, todayPending: 0, pastPending: 0, items: [] };

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <Sidebar
        activeYearName={activeYear?.name}
        attendancePendingCount={pending.pendingCount}
      />
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AttendanceReminderBanner summary={pending} compact />
            <YearSelector years={years} activeYearId={activeYear?.id} />
          </div>
        </header>
        <div className="flex-1 px-6 py-7 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
