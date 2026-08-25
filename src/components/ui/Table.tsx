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
        "overflow-hidden rounded-xl bg-surface-container-lowest shadow-tactile-md",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-body-md">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-right text-caption font-semibold tracking-wide text-on-surface-variant"
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
    <td className={cn("px-4 py-3.5 text-right text-on-surface", className)} dir={dir}>
      {children}
    </td>
  );
}
