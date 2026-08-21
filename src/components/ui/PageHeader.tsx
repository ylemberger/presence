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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-2 h-1 w-10 rounded-full bg-[var(--accent)]" aria-hidden />
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--brand)]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
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
    ok: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
    warn: "bg-amber-50 text-amber-900 ring-1 ring-amber-100",
    danger: "bg-rose-50 text-rose-800 ring-1 ring-rose-100",
    muted: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
