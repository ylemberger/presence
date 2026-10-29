"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  fieldClass,
  fieldSizeClass,
  labelSizeClass,
  type FieldSize,
} from "@/components/ui/Input";

const SEARCH_DEBOUNCE_MS = 160;

export function MultiSelect({
  label,
  name,
  options,
  values,
  onChange,
  onClose,
  hint,
  fieldSize = "md",
  emptyLabel = "הכל",
  placeholder = "הקלידי לחיפוש…",
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  /** Called when the list closes, with the current selection. */
  onClose?: (next: string[]) => void;
  hint?: string;
  fieldSize?: FieldSize;
  emptyLabel?: string;
  placeholder?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const inputId = `${autoId}-input`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedOptions = options.filter((opt) => selectedSet.has(opt.value));
  const optionIds = options.map((opt) => opt.value);
  const allSelected = optionIds.length > 0 && optionIds.every((id) => selectedSet.has(id));

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const matches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return options;
    const tokens = q.split(/\s+/).filter(Boolean);
    return options.filter((opt) => {
      const hay = opt.label.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [options, debouncedQuery]);

  const rows = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q) return matches.map((opt) => ({ kind: "option" as const, opt }));
    return [{ kind: "all" as const }, ...matches.map((opt) => ({ kind: "option" as const, opt }))];
  }, [debouncedQuery, matches]);

  const summaryLabel = useMemo(() => {
    if (selectedOptions.length === 0) return emptyLabel;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    if (selectedOptions.length === 2) {
      return `${selectedOptions[0].label} · ${selectedOptions[1].label}`;
    }
    return `${selectedOptions[0].label} +${selectedOptions.length - 1}`;
  }, [emptyLabel, selectedOptions]);

  const updateBox = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = r.width;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setBox({ top: r.bottom + 4, left, width });
  }, []);

  function closeMenu() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    onCloseRef.current?.(valuesRef.current);
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
    setQuery("");
    setDebouncedQuery("");
  }

  function toggleAll() {
    onChange(allSelected ? [] : optionIds);
    setQuery("");
    setDebouncedQuery("");
  }

  function handleFocus() {
    setQuery("");
    setDebouncedQuery("");
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

  function activate(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "all") toggleAll();
    else toggle(row.opt.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Backspace" && !query && values.length > 0) {
      e.preventDefault();
      onChange(values.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(Math.max(rows.length - 1, 0), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(highlight);
    }
  }

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      const target = ev.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      if (!open) return;
      closeMenu();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [open, updateBox, query]);

  const statusCaption =
    fieldSize === "lg" ? "font-body-md text-body-md" : "font-caption text-caption";

  const list =
    open && box
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            className="z-[80] max-h-72 overflow-y-auto overflow-x-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-tactile-lg"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
            }}
          >
            {rows.length === 0 ? (
              <li className={cn("px-3 py-2 text-on-surface-variant", statusCaption)}>
                {query.trim()
                  ? "אין התאמה — המשיכי לכתוב"
                  : options.length
                    ? emptyLabel
                    : "אין אפשרויות"}
              </li>
            ) : (
              rows.map((row, i) => {
                const isAll = row.kind === "all";
                const checked = isAll ? allSelected : selectedSet.has(row.opt.value);
                const text = isAll ? emptyLabel : row.opt.label;
                return (
                  <li
                    key={isAll ? "__all__" : row.opt.value}
                    role="option"
                    aria-selected={checked}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-right transition-colors",
                        fieldSize === "lg"
                          ? "font-body-lg text-body-lg"
                          : "font-body-md text-body-md",
                        i === highlight
                          ? "bg-secondary-container/60 text-primary"
                          : checked
                            ? "bg-secondary-container/35 font-semibold text-primary"
                            : "text-on-surface hover:bg-surface-container"
                      )}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => activate(i)}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-outline-variant bg-surface-container-lowest"
                        )}
                        aria-hidden
                      >
                        {checked ? <Icon name="check" className="text-[12px]" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal">{text}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cn("block text-on-surface", labelSizeClass[fieldSize])}>
        {label}
      </label>
      {values.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
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
          aria-multiselectable="true"
          className={cn(
            fieldClass,
            fieldSizeClass[fieldSize],
            "w-full pe-9",
            selectedOptions.length > 0 && !query && "font-medium",
            selectedOptions.length === 0 && !open && "text-on-surface-variant"
          )}
          placeholder={placeholder}
          value={open ? query : summaryLabel}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {selectedOptions.length > 0 ? (
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-primary"
            aria-label="נקה"
            onClick={() => {
              onChange([]);
              setOpen(false);
              setQuery("");
              setDebouncedQuery("");
              onCloseRef.current?.([]);
            }}
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        ) : (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline-variant">
            <Icon name="search" className="text-[16px]" />
          </span>
        )}
      </div>
      {hint ? (
        <p
          className={cn(
            "text-on-surface-variant",
            fieldSize === "lg" ? "font-body-md text-body-md" : "font-caption text-caption"
          )}
        >
          {hint}
        </p>
      ) : null}
      {list}
    </div>
  );
}
