import { cn } from "@/lib/cn";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export function Table({ headers, children, className }: TableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-white",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
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
    <tr className={cn("transition-colors hover:bg-[var(--surface-muted)]/80", className)}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <td className={cn("px-4 py-3.5 text-right text-slate-700", className)} dir={dir}>
      {children}
    </td>
  );
}
