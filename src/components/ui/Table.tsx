import { cn } from "@/lib/cn";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function Table({ headers, children, className, compact = false }: TableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-surface-container-lowest shadow-tactile-md print:overflow-visible print:rounded-none print:shadow-none",
        className
      )}
    >
      <div className="overflow-x-auto print:overflow-visible">
        <table className={cn("w-full", compact ? "text-caption" : "text-body-md")}>
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low">
              {headers.map((header) => (
                <th
                  key={header}
                  className={cn(
                    "text-right font-semibold tracking-wide text-on-surface-variant print:bg-surface-container-low",
                    compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-caption"
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/25">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-[var(--accent-soft)]", className)}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
  dir,
  compact = false,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
  compact?: boolean;
}) {
  return (
    <td
      className={cn(
        "text-right text-on-surface",
        compact ? "px-2 py-0.5 leading-tight" : "px-3 py-2",
        className
      )}
      dir={dir}
    >
      {children}
    </td>
  );
}
