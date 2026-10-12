"use client";

import { useEffect, useRef } from "react";
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
  const someSelected = optionIds.some((id) => values.includes(id));
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

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
      {values.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div
        className={cn(
          "flex flex-col overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest",
          large ? "max-h-52" : "max-h-40"
        )}
      >
        {options.length === 0 ? (
          <p
            className={cn(
              "px-3 py-2 text-on-surface-variant",
              large ? "font-body-md text-body-md" : "font-caption text-caption"
            )}
          >
            אין אפשרויות
          </p>
        ) : (
          <>
            <label
              className={cn(
                "sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b border-outline-variant/40 bg-surface-container-low px-3 py-1.5 font-semibold text-primary",
                large ? "text-body-lg" : "text-body-sm"
              )}
            >
              <input
                ref={allRef}
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange(allSelected ? [] : optionIds)}
                className="rounded border-outline-variant"
              />
              הכל
            </label>
            <div className="flex flex-col gap-1 px-3 py-2">
              {options.map((opt) => {
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
              })}
            </div>
          </>
        )}
      </div>
    </fieldset>
  );
}
