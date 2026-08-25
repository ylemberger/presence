"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-2.5 font-label-md text-label-md text-on-secondary shadow-tactile-sm transition-all hover:-translate-y-0.5 hover:bg-secondary-fixed-dim print:hidden"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        print
      </span>
      הדפסת כרטיס
    </button>
  );
}
