"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

interface ReportsFilterProps {
  classes: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  defaults: { startDate: string; endDate: string; minAbsence: string };
}

export function ReportsFilter({ classes, students, defaults }: ReportsFilterProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const classId = fd.get("classId") as string;
    const studentId = fd.get("studentId") as string;
    const startDate = fd.get("startDate") as string;
    const endDate = fd.get("endDate") as string;
    const minAbsence = fd.get("minAbsence") as string;

    if (classId) params.set("classId", classId);
    if (studentId) params.set("studentId", studentId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (minAbsence) params.set("minAbsence", minAbsence);

    router.push(`/reports?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="כיתה"
        name="classId"
        options={[
          { value: "", label: "כל הכיתות" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="תלמידה"
        name="studentId"
        options={[
          { value: "", label: "כל התלמידות" },
          ...students.map((s) => ({ value: s.id, label: s.full_name })),
        ]}
      />
      <Input label="מתאריך" name="startDate" type="date" defaultValue={defaults.startDate} />
      <Input label="עד תאריך" name="endDate" type="date" defaultValue={defaults.endDate} />
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
