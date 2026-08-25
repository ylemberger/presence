"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
  /** Optional footer (buttons row). Rendered on bg-surface-container-lowest. */
  footer?: React.ReactNode;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className,
  dismissible = true,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_160ms_ease-out] sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="סגירה"
        className="absolute inset-0 bg-on-background/50 backdrop-blur-sm"
        onClick={() => dismissible && onClose()}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface shadow-tactile-lg animate-[scaleIn_180ms_ease-out]",
          className
        )}
      >
        <div className="flex items-center justify-between gap-4 rounded-t-xl border-b border-outline-variant/30 bg-surface-container-low px-6 py-4">
          <div>
            <h2 className="font-title-lg text-title-lg text-primary">{title}</h2>
            {description && (
              <p className="mt-1 text-caption text-on-surface-variant">{description}</p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-error-container/20 hover:text-error"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 rounded-b-xl border-t border-outline-variant/30 bg-surface-container-lowest px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
