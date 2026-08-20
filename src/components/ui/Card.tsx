import { cn } from "@/lib/cn";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function Card({ title, children, className, actions }: CardProps) {
  return (
    <div className={cn("rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          {title && <h2 className="text-lg font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
