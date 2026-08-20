import { cn } from "@/lib/cn";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function Card({ title, children, className, actions }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
