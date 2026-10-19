import { Sidebar } from "@/components/layout/Sidebar";
import { AttendanceReminderBanner } from "@/components/attendance/AttendanceReminderBanner";
import { getPendingAttendanceSummary } from "@/lib/attendance/pending";

type SidebarFields = {
  activeYearName?: string;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  viewOnly?: boolean;
};

export async function PendingSidebar({
  yearId,
  ...sidebar
}: SidebarFields & { yearId: string | null }) {
  const pending = yearId ? await getPendingAttendanceSummary(yearId) : null;
  return <Sidebar {...sidebar} attendancePendingCount={pending?.pendingCount ?? 0} />;
}

export async function PendingBanner({ yearId }: { yearId: string | null }) {
  if (!yearId) return null;
  const pending = await getPendingAttendanceSummary(yearId);
  return <AttendanceReminderBanner summary={pending} compact />;
}
