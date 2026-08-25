import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /**
   * Visual size for the heading:
   * - "display" (default): 48px Display-lg — for top-level pages (Dashboard, Students, Reports).
   * - "headline": 32px Headline-lg — for secondary pages (Attendance, Lessons, Makeup, Settings).
   */
  size?: "display" | "headline";
}

export function PageHeader({
  title,
  description,
  actions,
  size = "display",
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className={cn(
            "text-primary",
            size === "display"
              ? "font-display-lg text-display-lg"
              : "font-headline-lg text-headline-lg"
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Small status pill following the Stitch design language.
 * Uses design tokens so colors stay consistent with attendance semantics.
 */
export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    ok: "status-pill-ok",
    warn: "status-pill-warning",
    danger: "status-pill-blocked",
    muted: "bg-surface-container-low text-on-surface-variant",
    info: "bg-primary/10 text-primary",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
