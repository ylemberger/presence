"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className,
  dismissible = true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="סגירה"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-[var(--brand)] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-white/80">{description}</p>}
          </div>
          {dismissible && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10"
            >
              סגירה
            </Button>
          )}
        </div>
        <div className="max-h-[min(80vh,40rem)] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
