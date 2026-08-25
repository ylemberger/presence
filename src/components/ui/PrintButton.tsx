"use client";

import { Icon } from "@/components/ui/Icon";

interface PrintButtonProps {
  /** Button text. Defaults to student-card wording. */
  label?: string;
  /** Temporary document title so Save-as-PDF uses a meaningful filename. */
  documentTitle?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function PrintButton({
  label = "הדפסת כרטיס",
  documentTitle,
  disabled = false,
  disabledReason = "אין נתונים להדפסה",
}: PrintButtonProps) {
  function handlePrint() {
    const previousTitle = document.title;
    if (documentTitle) {
      document.title = documentTitle;
    }
    window.print();
    if (documentTitle) {
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 500);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-2.5 font-label-md text-label-md text-on-secondary shadow-tactile-sm transition-all hover:-translate-y-0.5 hover:bg-secondary-fixed-dim disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 print:hidden"
    >
      <Icon name="print" className="text-[18px]" />
      {label}
    </button>
  );
}
