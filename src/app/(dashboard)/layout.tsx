import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import { AccessProvider } from "@/components/auth/AccessProvider";
import { authUserProfile } from "@/lib/auth/user-profile";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { PendingBanner, PendingSidebar } from "@/components/layout/PendingChrome";
import { Icon } from "@/components/ui/Icon";
import { ScrollKeeper } from "@/components/layout/ScrollKeeper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessRole } = await requireAuthenticatedUser();
  const profile = authUserProfile(user);
  const listOnly = accessRole === "viewer";
  const canWrite = accessRole === "editor";

  const [activeYear, years] = await Promise.all([
    getActiveAcademicYear(),
    getAllAcademicYears(),
  ]);

  const sidebarProps = {
    activeYearName: activeYear?.name,
    userEmail: profile.email,
    userName: profile.displayName,
    userAvatarUrl: profile.avatarUrl,
    viewOnly: listOnly,
  };

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <NavigationProgress />
        <ScrollKeeper />
      </Suspense>
      <Suspense fallback={<Sidebar {...sidebarProps} attendancePendingCount={0} />}>
        <PendingSidebar {...sidebarProps} yearId={listOnly ? null : activeYear?.id ?? null} />
      </Suspense>
      {/* Main Content Area — offset right by the fixed sidebar width */}
      <main className="relative mr-[var(--sidebar-width)] flex min-h-screen w-[calc(100%-var(--sidebar-width))] min-w-0 flex-1 flex-col transition-[margin,width] duration-200 print:mr-0 print:w-full">
        {/* TopAppBar */}
        <header className="print:hidden sticky top-0 z-40 flex items-center justify-between gap-4 bg-surface/95 px-container_padding py-2 shadow-tactile-sm backdrop-blur-md">
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
            <Suspense fallback={null}>
              <PendingBanner yearId={listOnly ? null : activeYear?.id ?? null} />
            </Suspense>
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-secondary"
              aria-label="התראות"
            >
              <Icon name="notifications" />
            </button>
            <div
              className="flex items-center gap-2 rounded-full py-0.5 pe-1"
              title={profile.email ?? profile.displayName}
            >
              <span className="hidden max-w-[9rem] truncate text-label-md font-semibold text-primary sm:inline">
                {profile.displayName}
              </span>
              <UserAvatar
                name={profile.displayName}
                email={profile.email}
                imageUrl={profile.avatarUrl}
                size="sm"
              />
            </div>
            <div className="mx-2 hidden h-6 w-px bg-outline-variant md:block" />
            {canWrite ? <YearSelector years={years} activeYearId={activeYear?.id} /> : null}
          </div>
        </header>
        {/* Canvas */}
        <div className="mx-auto flex w-full max-w-canvas flex-1 flex-col gap-stack_lg p-container_padding print:max-w-none print:gap-4 print:p-0">
          <AccessProvider canWrite={canWrite} listOnly={listOnly}>
            {children}
          </AccessProvider>
        </div>
      </main>
    </div>
  );
}
