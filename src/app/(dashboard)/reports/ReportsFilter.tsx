"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";

interface ReportsFilterProps {
  classes: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  rules: { id: string; name: string; max_allowed_absence_percent: number }[];
  defaults: {
    startDate: string;
    endDate: string;
    minAbsence: string;
    classId?: string;
    studentId?: string;
    ruleId?: string;
  };
}

export function ReportsFilter({
  classes,
  students,
  rules,
  defaults,
}: ReportsFilterProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["classId", "studentId", "startDate", "endDate", "minAbsence", "ruleId"]) {
      const value = fd.get(key) as string;
      if (value) params.set(key, value);
    }
    params.set("run", "1");
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="כיתה"
        name="classId"
        defaultValue={defaults.classId ?? ""}
        options={[
          { value: "", label: "כל הכיתות" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="תלמידה"
        name="studentId"
        defaultValue={defaults.studentId ?? ""}
        options={[
          { value: "", label: "כל התלמידות" },
          ...students.map((s) => ({ value: s.id, label: s.full_name })),
        ]}
      />
      <HebrewDateInput label="מתאריך" name="startDate" defaultValue={defaults.startDate} required />
      <HebrewDateInput label="עד תאריך" name="endDate" defaultValue={defaults.endDate} required />
      <Select
        label="כלל נוכחות"
        name="ruleId"
        defaultValue={defaults.ruleId ?? ""}
        options={[
          { value: "", label: "ללא סף מכלל" },
          ...rules.map((r) => ({
            value: r.id,
            label: `${r.name} (${r.max_allowed_absence_percent}%)`,
          })),
        ]}
      />
      <Input
        label="אחוז היעדרות מינימלי"
        name="minAbsence"
        type="number"
        step="0.01"
        defaultValue={defaults.minAbsence}
      />
      <Button type="submit">הצג דוח</Button>
    </form>
  );
}
