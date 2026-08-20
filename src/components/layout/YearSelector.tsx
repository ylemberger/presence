"use client";

import { useRouter } from "next/navigation";
import type { AcademicYear } from "@/types/database";
import { Select } from "@/components/ui/Input";
import { setActiveYearAction } from "@/app/(dashboard)/actions";

interface YearSelectorProps {
  years: AcademicYear[];
  activeYearId?: string;
}

export function YearSelector({ years, activeYearId }: YearSelectorProps) {
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await setActiveYearAction(e.target.value);
    router.refresh();
  }

  if (years.length === 0) return null;

  return (
    <div className="print:hidden">
      <Select
        label="שנה אקדמית"
        value={activeYearId || ""}
        onChange={handleChange}
        options={years.map((y) => ({
          value: y.id,
          label: `${y.name}${y.is_active ? " (פעילה)" : ""}`,
        }))}
        className="w-48"
      />
    </div>
  );
}
