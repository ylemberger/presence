import Link from "next/link";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import type { PendingAttendanceSummary } from "@/lib/attendance/pending";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

interface AttendanceReminderBannerProps {
  summary: PendingAttendanceSummary;
  /** Compact strip for layout header */
  compact?: boolean;
}

/**
 * Full-width Stitch banner: bg-surface with a left accent border in attendance-late,
 * a circular icon chip and a linked call to action.
 */
export function AttendanceReminderBanner({
  summary,
  compact,
}: AttendanceReminderBannerProps) {
  if (summary.pendingCount === 0) return null;

  const first = summary.items[0];
  const href = first
    ? `/attendance?date=${first.date}&occurrenceId=${first.id}`
    : "/attendance";

  if (compact) {
    return (
      <Link
        href={href}
        className={cn(
          "print:hidden inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors",
          summary.pastPending > 0
            ? "status-pill-warning ring-1 ring-attendance-late/25 hover:brightness-95"
            : "status-pill-ok ring-1 ring-attendance-present/25 hover:brightness-95"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            summary.pastPending > 0 ? "bg-attendance-late dot-warning" : "bg-attendance-present"
          )}
          aria-hidden
        />
        <span className="truncate">
          {summary.pastPending > 0
            ? `${summary.pastPending} שיעורים ממתינים לרישום`
            : `${summary.todayPending} שיעורים היום ממתינים`}
        </span>
        <span className="shrink-0 opacity-70">←</span>
      </Link>
    );
  }

  const isLate = summary.pastPending > 0;

  return (
    <div
      className={cn(
        "print:hidden card-hover flex flex-col gap-3 rounded-r-lg rounded-l-md border-l-4 bg-surface p-4 shadow-tactile-sm sm:flex-row sm:items-center sm:justify-between",
        isLate ? "border-attendance-late" : "border-secondary"
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isLate
              ? "bg-attendance-late/10 text-attendance-late"
              : "bg-secondary/10 text-secondary"
          )}
          aria-hidden
        >
          <Icon name="notification_important" />
        </div>
        <div>
          <p className="font-body-lg text-body-lg font-medium text-primary">
            {isLate
              ? `ישנם ${summary.pastPending} שיעורים ממתינים לרישום נוכחות`
              : `ישנם ${summary.todayPending} שיעורים היום ממתינים לרישום`}
          </p>
          {summary.items.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-caption text-on-surface-variant">
              {summary.items.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/attendance?date=${item.date}&occurrenceId=${item.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatHebrewDate(item.date)} · {item.subject}
                  </Link>
                  <span className="text-on-surface-variant">
                    {" "}
                    ({item.marked}/{item.total})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 self-end text-label-md text-secondary transition-colors hover:underline sm:self-auto"
      >
        לרישום
        <Icon name="arrow_back" className="text-[18px]" />
      </Link>
    </div>
  );
}
