import { cn } from "@/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
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
      "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-soft)] active:translate-y-px",
    secondary:
      "bg-white text-slate-800 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]",
    danger: "bg-rose-600 text-white shadow-[var(--shadow-sm)] hover:bg-rose-700 active:translate-y-px",
    ghost: "bg-transparent text-slate-600 hover:bg-[var(--surface-muted)] hover:text-slate-800",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
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
