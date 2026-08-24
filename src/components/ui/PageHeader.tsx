import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-display-lg text-display-lg text-primary">{title}</h2>
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

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    ok: "status-pill-ok",
    warn: "status-pill-warning",
    danger: "status-pill-blocked",
    muted: "bg-surface-container-low text-on-surface-variant",
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
