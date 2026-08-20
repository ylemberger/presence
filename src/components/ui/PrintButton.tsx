"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 print:hidden"
    >
      הדפסה
    </button>
  );
}
