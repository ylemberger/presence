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

/** Reminder for pending attendance. Compact = header pill; default = one-line strip. */
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
          {summary.partialCount > 0
            ? `${summary.partialCount} שיעורים סומנו חלקית`
            : summary.incompleteWeeks.length > 0
              ? `שבוע לא הושלם (${formatHebrewDate(summary.incompleteWeeks[0].weekStart)})`
              : summary.pastPending > 0
                ? `${summary.pastPending} שיעורים ממתינים לרישום`
                : `${summary.todayPending} שיעורים היום ממתינים`}
        </span>
        <span className="shrink-0 opacity-70">←</span>
      </Link>
    );
  }

  const isLate = summary.pastPending > 0;
  const title =
    summary.partialCount > 0
      ? `${summary.partialCount} שיעורים סומנו חלקית`
      : isLate
        ? `${summary.pastPending} שיעורים ממתינים לסימון`
        : `${summary.todayPending} שיעורים היום ממתינים לסימון`;
  const weekHint =
    summary.incompleteWeeks.length > 0
      ? `שבוע ${formatHebrewDate(summary.incompleteWeeks[0].weekStart)} עדיין פתוח${
          summary.incompleteWeeks.length > 1
            ? ` · ועוד ${summary.incompleteWeeks.length - 1}`
            : ""
        }`
      : first
        ? `הבא: ${formatHebrewDate(first.date)} · ${first.subject}`
        : null;

  return (
    <div
      className={cn(
        "print:hidden flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        isLate
          ? "border-attendance-late/30 bg-attendance-late/10"
          : "border-secondary/25 bg-secondary/5"
      )}
      role="status"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isLate ? "bg-attendance-late" : "bg-secondary"
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 truncate font-caption text-caption text-on-surface">
        <span className="font-semibold text-primary">{title}</span>
        {weekHint ? (
          <span className="text-on-surface-variant"> · {weekHint}</span>
        ) : null}
      </p>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-0.5 font-label-md text-label-md text-secondary transition-colors hover:bg-surface-container-lowest"
      >
        לרישום
        <Icon name="arrow_back" className="text-[16px]" />
      </Link>
    </div>
  );
}
