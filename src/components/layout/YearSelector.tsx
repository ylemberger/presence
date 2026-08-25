"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AcademicYear } from "@/types/database";
import { setActiveYearAction } from "@/app/(dashboard)/actions";
import { Icon } from "@/components/ui/Icon";

interface YearSelectorProps {
  years: AcademicYear[];
  activeYearId?: string;
}

/**
 * Compact "בחירת שנה" pill that mirrors the Stitch top-app-bar button.
 * The native select overlay keeps accessibility while the label stays visual.
 */
export function YearSelector({ years, activeYearId }: YearSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (years.length === 0) return null;

  const activeYear = years.find((y) => y.id === activeYearId);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    if (!nextId || nextId === activeYearId) return;
    startTransition(async () => {
      await setActiveYearAction(nextId);
      router.refresh();
    });
  }

  return (
    <div className="relative print:hidden">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none inline-flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-label-md font-semibold text-primary shadow-tactile-sm transition-colors hover:bg-secondary-fixed-dim"
      >
        <Icon name="calendar_today" className="text-[18px]" />
        <span>{activeYear ? activeYear.name : "בחירת שנה"}</span>
        <Icon name="expand_more" className="text-[18px] opacity-80" />
      </button>
      <select
        aria-label="בחירת שנה אקדמית"
        value={activeYearId || ""}
        onChange={handleChange}
        disabled={isPending}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.is_active ? " (פעילה)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
