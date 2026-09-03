import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

interface SectionProps {
  /** Optional icon name from `Icon`. Rendered in secondary color next to the title. */
  icon?: string;
  /** Section title (font-title-lg, primary color). */
  title?: string;
  /** Small subtitle rendered under the title. */
  subtitle?: string;
  /** Actions rendered on the far side of the header (buttons, search, etc.). */
  actions?: React.ReactNode;
  /**
   * Visual accent — matches Stitch bento sections:
   * - "featured": top border in secondary/gold (for forms, "add new" panels).
   * - "danger": top border in error (for critical/threshold cards).
   * - "info": top border in secondary-container (for KPI-like cards).
   * - "none" (default): plain card with subtle border and shadow.
   */
  accent?: "featured" | "danger" | "info" | "none";
  titleClassName?: string;
  /** Removes the default outer padding of the body area (useful for tables). */
  bodyBleed?: boolean;
  className?: string;
  headerClassName?: string;
  children: React.ReactNode;
}

const accentClass: Record<NonNullable<SectionProps["accent"]>, string> = {
  featured: "border-t-4 border-t-secondary",
  danger: "border-t-4 border-t-error",
  info: "border-t-4 border-t-secondary-container",
  none: "",
};

/**
 * Bento-style content panel used across Stitch mockups.
 * Provides a consistent card + header + body layout.
 */
export function Section({
  icon,
  title,
  subtitle,
  actions,
  accent = "none",
  bodyBleed,
  className,
  headerClassName,
  titleClassName,
  children,
}: SectionProps) {
  const hasHeader = Boolean(title || actions);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md print:overflow-visible print:rounded-none print:shadow-none",
        accentClass[accent],
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container-low/60 px-6 py-4",
            headerClassName
          )}
        >
          <div className="min-w-0">
            {title && (
              <h3
                className={cn(
                  "flex items-center gap-2 font-title-lg text-title-lg text-primary",
                  titleClassName
                )}
              >
                {icon && (
                  <Icon name={icon} className="text-secondary" />
                )}
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 font-caption text-caption text-on-surface-variant">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(bodyBleed ? "" : "p-6")}>{children}</div>
    </section>
  );
}
