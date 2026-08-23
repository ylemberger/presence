import Link from "next/link";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import type { PendingAttendanceSummary } from "@/lib/attendance/pending";
import { cn } from "@/lib/cn";

interface AttendanceReminderBannerProps {
  summary: PendingAttendanceSummary;
  /** Compact strip for layout header */
  compact?: boolean;
}

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
          "print:hidden inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
          summary.pastPending > 0
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 hover:bg-amber-100"
            : "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 hover:bg-sky-100"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            summary.pastPending > 0 ? "bg-amber-500" : "bg-sky-500"
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

  return (
    <div
      className={cn(
        "print:hidden mb-5 rounded-2xl border px-4 py-3 sm:px-5",
        summary.pastPending > 0
          ? "border-amber-200 bg-amber-50/80"
          : "border-sky-200 bg-sky-50/80"
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              summary.pastPending > 0 ? "text-amber-950" : "text-sky-950"
            )}
          >
            {summary.pastPending > 0
              ? "יש שיעורים שעדיין לא נרשמה בהם נוכחות"
              : "יש שיעורים היום שממתינים לרישום"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {summary.pastPending > 0 && (
              <>
                {summary.pastPending} מימים קודמים
                {summary.todayPending > 0 ? ` · ${summary.todayPending} היום` : ""}
                . רישום קצר עכשיו שומר על הדוחות מדויקים.
              </>
            )}
            {summary.pastPending === 0 && (
              <>סמני את שיעורי היום לפני שסוגרים את היום — זה לוקח דקה.</>
            )}
          </p>
          {summary.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {summary.items.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/attendance?date=${item.date}&occurrenceId=${item.id}`}
                    className="font-medium text-[var(--brand)] hover:underline"
                  >
                    {formatHebrewDate(item.date)} · {item.subject}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    ({item.marked}/{item.total})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href={href}
          className={cn(
            "shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm",
            summary.pastPending > 0 ? "bg-amber-700 hover:bg-amber-800" : "bg-[var(--brand)] hover:bg-[var(--brand-soft)]"
          )}
        >
          השלמת רישום
        </Link>
      </div>
    </div>
  );
}
