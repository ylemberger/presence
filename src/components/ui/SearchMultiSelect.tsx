"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { fieldClass, fieldSizeClass, labelSizeClass } from "@/components/ui/Input";

export type SearchMultiOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
};

function optionMatches(opt: SearchMultiOption, q: string) {
  if (!q) return true;
  const hay = [opt.label, opt.description, opt.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

export function SearchMultiSelect({
  label,
  values,
  onChange,
  options,
  placeholder = "הקלידי לחיפוש…",
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: SearchMultiOption[];
  placeholder?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const inputId = `${autoId}-input`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = useMemo(
    () => options.filter((opt) => values.includes(opt.value)),
    [options, values]
  );
  const selectedCount = selected.length;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((opt) => optionMatches(opt, q));
  }, [options, query]);

  const closedLabel =
    selectedCount === 0
      ? "הכל"
      : selectedCount === 1
        ? selected[0].label
        : `${selectedCount} נבחרו`;

  const updateBox = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 280), Math.max(window.innerWidth - 16, r.width));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setBox({ top: r.bottom + 4, left, width });
  }, []);

  function toggle(id: string) {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  }

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      const target = ev.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [open, updateBox, query, matches.length]);

  const optionIds = options.map((opt) => opt.value);
  const allSelected = optionIds.length > 0 && optionIds.every((id) => values.includes(id));

  const list =
    open && box
      ? createPortal(
          <div
            ref={listRef}
            id={listId}
            className="z-[80] max-h-72 overflow-y-auto overflow-x-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-tactile-lg"
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width }}
          >
            <label className="sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b border-outline-variant/40 bg-surface-container-low px-3 py-2 font-label-md text-label-md font-semibold text-primary">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange(allSelected ? [] : optionIds)}
                className="h-4 w-4 rounded border-outline-variant accent-primary"
              />
              הכל
            </label>
            {options.length === 0 ? (
              <p className="px-3 py-2 font-caption text-caption text-on-surface-variant">
                אין אפשרויות לפי הסינון
              </p>
            ) : matches.length === 0 ? (
              <p className="px-3 py-2 font-caption text-caption text-on-surface-variant">
                אין התאמה — המשיכי לכתוב
              </p>
            ) : (
              matches.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 px-3 py-2 font-body-md text-body-md",
                      checked
                        ? "bg-secondary-container/70 font-semibold text-primary"
                        : "text-on-surface hover:bg-surface-container"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block whitespace-normal">{opt.label}</span>
                      {opt.description ? (
                        <span className="mt-0.5 block font-caption text-caption font-normal text-on-surface-variant">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className={cn("flex items-center gap-1.5 text-on-surface", labelSizeClass.md)}>
        <span>{label}</span>
        {selectedCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 font-caption text-[10px] font-bold leading-none text-white">
            {selectedCount}
          </span>
        ) : null}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={cn(
            fieldClass,
            fieldSizeClass.md,
            "w-full pe-9",
            selectedCount > 0 && !open && "border-primary font-medium"
          )}
          placeholder={placeholder}
          value={open ? query : closedLabel}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            updateBox();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            updateBox();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        {selectedCount > 0 ? (
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-primary"
            aria-label="נקה"
            onClick={() => onChange([])}
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        ) : (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline-variant">
            <Icon name="search" className="text-[16px]" />
          </span>
        )}
      </div>
      {list}
    </div>
  );
}
