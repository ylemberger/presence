import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";
import { Icon } from "@/components/ui/Icon";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAuthenticatedUser();

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
        userEmail={user.email}
      />
      {/* Main Content Area — offset right by the fixed sidebar width */}
      <main className="relative mr-[17.5rem] flex min-h-screen w-[calc(100%-17.5rem)] min-w-0 flex-1 flex-col">
        {/* TopAppBar */}
        <header className="print:hidden sticky top-0 z-40 flex items-center justify-between gap-4 bg-surface/95 px-container_padding py-4 shadow-tactile-sm backdrop-blur-md">
          <div className="font-headline-md text-headline-md font-bold text-primary">
            מערכת ניהול פנימית
          </div>
          <div className="hidden items-center gap-6 md:flex">
            {activeYear && (
              <span className="border-b-2 border-secondary pb-1 text-label-md font-bold text-primary">
                {activeYear.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <AttendanceReminderBanner summary={pending} compact />
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-secondary"
              aria-label="התראות"
            >
              <Icon name="notifications" />
            </button>
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-secondary"
              aria-label="פרופיל"
            >
              <Icon name="account_circle" />
            </button>
            <div className="mx-2 hidden h-6 w-px bg-outline-variant md:block" />
            <YearSelector years={years} activeYearId={activeYear?.id} />
          </div>
        </header>
        {/* Canvas */}
        <div className="mx-auto flex w-full max-w-canvas flex-1 flex-col gap-stack_lg p-container_padding">
          {children}
        </div>
      </main>
    </div>
  );
}
