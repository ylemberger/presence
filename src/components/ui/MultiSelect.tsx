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

  const selectedOptions = options.filter((opt) => values.includes(opt.value));
  const selectedCount = selectedOptions.length;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn("flex items-center gap-2 text-on-surface", labelSizeClass[fieldSize])}>
        <span>{label}</span>
        {selectedCount > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 font-caption text-[11px] font-bold leading-none text-white">
            {selectedCount}
          </span>
        ) : null}
      </legend>
      <p
        className={cn(
          selectedCount > 0 ? "font-semibold text-primary" : "text-on-surface-variant",
          large ? "font-body-md text-body-md" : "font-caption text-caption"
        )}
      >
        {selectedCount > 0
          ? `${selectedCount} נבחרו`
          : hint ?? "אפשר לבחור כמה"}
      </p>
      {values.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.slice(0, 8).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 font-caption text-[11px] font-semibold text-primary"
              title={`הסירי את ${opt.label}`}
            >
              <span className="truncate">{opt.label}</span>
              <span aria-hidden className="text-[13px] leading-none">
                ×
              </span>
            </button>
          ))}
          {selectedCount > 8 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-[11px] font-semibold text-primary">
              +{selectedCount - 8}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-col overflow-y-auto rounded-lg border bg-surface-container-lowest",
          large ? "max-h-52" : "max-h-40",
          selectedCount > 0
            ? "border-2 border-primary shadow-tactile-sm"
            : "border-outline-variant"
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
                "sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b px-3 py-2 font-semibold text-primary",
                large ? "text-body-lg" : "text-body-sm",
                allSelected
                  ? "border-primary/30 bg-secondary-container"
                  : "border-outline-variant/40 bg-surface-container-low"
              )}
            >
              <input
                ref={allRef}
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange(allSelected ? [] : optionIds)}
                className="h-4 w-4 rounded border-outline-variant accent-primary"
              />
              הכל
            </label>
            <div className="flex flex-col gap-0.5 px-2 py-2">
              {options.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                      large ? "text-body-lg" : "text-body-sm",
                      checked
                        ? "bg-secondary-container font-semibold text-primary"
                        : "text-on-surface hover:bg-surface-container-low"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="h-4 w-4 rounded border-outline-variant accent-primary"
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
