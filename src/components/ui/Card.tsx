import { cn } from "@/lib/cn";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  /** Adds a top accent border in the secondary color (Stitch KPI style). */
  featured?: boolean;
  /** Adds a distinct top accent border for critical / alert cards. */
  accent?: "secondary" | "outline" | "attendance-late" | "attendance-absent" | "attendance-present";
  /** Title underline color (Stitch uses secondary or attendance-absent for exceptions). */
  titleUnderline?: "secondary" | "attendance-absent" | "none";
}

const accentBorder: Record<NonNullable<CardProps["accent"]>, string> = {
  secondary: "border-t-4 border-t-secondary",
  outline: "border-t-4 border-t-outline-variant",
  "attendance-late": "border-t-4 border-t-attendance-late",
  "attendance-absent": "border-t-4 border-t-attendance-absent",
  "attendance-present": "border-t-4 border-t-attendance-present",
};

export function Card({
  title,
  children,
  className,
  actions,
  featured,
  accent,
  titleUnderline = "secondary",
}: CardProps) {
  const accentKey: NonNullable<CardProps["accent"]> | undefined = accent
    ? accent
    : featured
      ? "secondary"
      : undefined;

  const underlineClass =
    titleUnderline === "secondary"
      ? "border-b-2 border-secondary"
      : titleUnderline === "attendance-absent"
        ? "border-b-2 border-attendance-absent"
        : "";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-surface-container-lowest shadow-tactile-md",
        accentKey && accentBorder[accentKey],
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-6">
          {title && (
            <h3
              className={cn(
                "inline-block pb-1 font-title-lg text-title-lg text-primary",
                underlineClass
              )}
            >
              {title}
            </h3>
          )}
          {actions}
        </div>
      )}
      <div className={cn(title || actions ? "px-6 pb-6 pt-2" : "p-6")}>{children}</div>
    </div>
  );
}
