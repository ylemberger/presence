import { cn } from "@/lib/cn";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function Card({ title, children, className, actions }: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-md)]",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/70 px-6 py-4">
          {title && (
            <h2 className="text-base font-semibold tracking-tight text-[var(--brand)]">{title}</h2>
          )}
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
