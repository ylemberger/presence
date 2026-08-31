"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

const MAX_SUGGESTIONS = 8;

const fieldClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 pe-9 text-body-md text-on-surface shadow-tactile-sm transition-colors placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
};

interface ComboboxProps {
  label?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
}

function optionMatches(opt: ComboboxOption, q: string) {
  if (!q) return true;
  return [opt.label, opt.description, opt.keywords]
    .filter(Boolean)
    .some((part) => part!.toLowerCase().includes(q));
}

function labelOf(
  options: ComboboxOption[],
  value: string,
  emptyLabel: string
) {
  if (!value) return emptyLabel;
  return options.find((o) => o.value === value)?.label ?? emptyLabel;
}

export function Combobox({
  label,
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  placeholder = "הקלידי לחיפוש…",
  emptyLabel = "הכל",
  required = false,
}: ComboboxProps) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const inputId = `${autoId}-input`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState(defaultValue);
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = value !== undefined ? value : internal;

  const selectedLabel = labelOf(options, selected, emptyLabel);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        shown: options.slice(0, MAX_SUGGESTIONS),
        extra: Math.max(0, options.length - MAX_SUGGESTIONS),
      };
    }
    const rows = options.filter((o) => optionMatches(o, q));
    return {
      shown: rows.slice(0, MAX_SUGGESTIONS),
      extra: Math.max(0, rows.length - MAX_SUGGESTIONS),
    };
  }, [options, query]);

  const showList =
    open &&
    (query.trim().length > 0 || (options.length > 0 && options.length <= MAX_SUGGESTIONS));

  const updateBox = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  function commit(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setQuery("");
    setOpen(false);
  }

  function handleFocus() {
    setQuery("");
    setOpen(true);
    setHighlight(0);
    updateBox();
  }

  function handleChange(raw: string) {
    setQuery(raw);
    setOpen(true);
    setHighlight(0);
    updateBox();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(Math.max(matches.shown.length - 1, 0), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches.shown[highlight];
      if (pick) commit(pick.value);
    }
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
    if (!showList) return;
    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [showList, updateBox, query]);

  const list =
    showList && box
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="z-[80] max-h-72 overflow-y-auto overflow-x-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-tactile-lg"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
            }}
          >
            {matches.shown.length === 0 ? (
              <li className="px-3 py-2 font-caption text-caption text-on-surface-variant">
                אין התאמה — המשיכי לכתוב
              </li>
            ) : (
              matches.shown.map((opt, i) => (
                <li key={`${opt.value}::${opt.label}`} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-right font-body-md text-body-md transition-colors",
                      i === highlight
                        ? "bg-secondary-container/60 text-primary"
                        : "text-on-surface hover:bg-surface-container"
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => commit(opt.value)}
                  >
                    <span className="block whitespace-normal">{opt.label}</span>
                    {opt.description ? (
                      <span className="mt-0.5 block whitespace-normal font-caption text-caption text-on-surface-variant">
                        {opt.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
            {matches.extra > 0 && (
              <li className="border-t border-outline-variant/40 px-3 py-1.5 font-caption text-caption text-on-surface-variant">
                עוד {matches.extra} — המשיכי לכתוב לצמצום
              </li>
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="block font-label-md text-label-md text-on-surface">
          {label}
        </label>
      )}
      {name && <input type="hidden" name={name} value={selected} required={required} />}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          className={cn(
            fieldClass,
            selected && !query && "font-medium",
            !selected && !open && "text-on-surface-variant"
          )}
          placeholder={placeholder}
          value={open ? query : selectedLabel}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {selected ? (
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-primary"
            aria-label="נקה"
            onClick={() => commit("")}
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
