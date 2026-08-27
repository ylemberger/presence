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
        "overflow-hidden rounded-xl bg-surface-container-lowest shadow-tactile-md print:overflow-visible print:rounded-none print:shadow-none",
        className
      )}
    >
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-body-md">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-right text-caption font-semibold tracking-wide text-on-surface-variant print:bg-surface-container-low"
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
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <td className={cn("px-3 py-2 text-right text-on-surface", className)} dir={dir}>
      {children}
    </td>
  );
}
