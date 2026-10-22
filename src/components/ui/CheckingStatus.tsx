"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export function CheckingStatus({
  query,
  loading = false,
  count,
  className,
}: {
  query?: string;
  loading?: boolean;
  count?: number;
  className?: string;
}) {
  const q = query?.trim() ?? "";
  const text = loading
    ? "בודקת נתונים…"
    : q
      ? count == null
        ? `מחפשת «${q}»…`
        : `מחפשת «${q}» · ${count} התאמות`
      : "בודקת נתונים…";

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-primary", className)}
      aria-live="polite"
    >
      <Icon name="sync" className="animate-spin text-[16px]" />
      <span>{text}</span>
    </span>
  );
}
