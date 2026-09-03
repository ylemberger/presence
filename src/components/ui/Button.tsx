import { cn } from "@/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-primary text-white shadow-tactile-sm hover:bg-primary-container hover:text-white active:translate-y-px",
    secondary:
      "bg-secondary text-primary shadow-tactile-sm hover:bg-secondary-fixed-dim active:translate-y-px",
    danger:
      "bg-error text-on-error shadow-tactile-sm hover:bg-[#93000a] active:translate-y-px",
    ghost:
      "bg-transparent text-primary hover:bg-surface-container-low",
    outline:
      "bg-surface-container-lowest text-primary border border-outline-variant shadow-tactile-sm hover:bg-surface-container-low",
  } as const;

  const sizes = {
    sm: "px-3 py-1.5 text-caption",
    md: "px-4 py-2.5 text-label-md",
    lg: "px-6 py-3.5 text-title-lg",
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-[0.01em] transition-[color,background-color,border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
