import { cn } from "@/lib/cn";

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[var(--shadow-sm)] transition-colors placeholder:text-slate-400 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-600">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(fieldClass, error && "border-rose-400 focus:ring-rose-200", className)}
        {...props}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const selectId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-600">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          fieldClass,
          "appearance-none bg-[length:1rem] bg-[left_0.85rem_center] bg-no-repeat pe-9 ps-3.5",
          error && "border-rose-400 focus:ring-rose-200",
          className
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        }}
        {...props}
      >
        {options.map((opt, index) => (
          <option key={`${opt.value}::${opt.label}::${index}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
