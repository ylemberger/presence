"use client";

import { cn } from "@/lib/cn";
import { labelSizeClass, type FieldSize } from "@/components/ui/Input";

export function MultiSelect({
  label,
  name,
  options,
  values,
  onChange,
  hint,
  fieldSize = "md",
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  fieldSize?: FieldSize;
}) {
  function toggle(id: string) {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  }

  const large = fieldSize === "lg";
  const optionIds = options.map((opt) => opt.value);
  const allSelected =
    optionIds.length > 0 && optionIds.every((id) => values.includes(id));

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn("text-on-surface", labelSizeClass[fieldSize])}>{label}</legend>
      {hint && (
        <p
          className={cn(
            "text-on-surface-variant",
            large ? "font-body-md text-body-md" : "font-caption text-caption"
          )}
        >
          {hint}
        </p>
      )}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(optionIds)}
            disabled={allSelected}
            className="font-label-md text-label-md text-secondary hover:underline disabled:text-on-surface-variant disabled:no-underline"
          >
            בחרי הכול
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={values.length === 0}
            className="font-label-md text-label-md text-secondary hover:underline disabled:text-on-surface-variant disabled:no-underline"
          >
            נקי
          </button>
        </div>
      )}
      {values.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div
        className={cn(
          "flex flex-col gap-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2",
          large ? "max-h-52" : "max-h-40"
        )}
      >
        {options.length === 0 ? (
          <p
            className={cn(
              "text-on-surface-variant",
              large ? "font-body-md text-body-md" : "font-caption text-caption"
            )}
          >
            אין אפשרויות
          </p>
        ) : (
          options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1 py-1",
                  large ? "text-body-lg" : "text-body-sm",
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
