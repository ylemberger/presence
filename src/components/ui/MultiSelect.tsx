"use client";

import { cn } from "@/lib/cn";

export function MultiSelect({
  label,
  name,
  options,
  values,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  function toggle(id: string) {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-label-md text-label-md text-on-surface">{label}</legend>
      {hint && <p className="font-caption text-caption text-on-surface-variant">{hint}</p>}
      {values.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2">
        {options.length === 0 ? (
          <p className="font-caption text-caption text-on-surface-variant">אין אפשרויות</p>
        ) : (
          options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-body-sm",
                  checked ? "bg-secondary-container/50 text-primary" : "text-on-surface"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="rounded border-outline-variant"
                />
                {opt.label}
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
