"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { transferStudentAction } from "../../actions";
import type { AcademicYear, Grade, Class, Track, Specialization } from "@/types/database";

interface YearData {
  year: AcademicYear;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
}

interface Props {
  studentId: string;
  yearData: YearData;
}

export function StudentDetailForms({ studentId, yearData }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("student_id", studentId);
    fd.set("academic_year_id", yearData.year.id);
    const result = await transferStudentAction(fd);
    if (result && "error" in result && result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        שינוי כיתה/מסלול/התמחות נעשה רק בהעברה. השיבוץ הקודם נסגר ונשמר בהיסטוריה.
      </p>
      <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-3">
        <HebrewDateInput label="בתוקף מתאריך" name="transfer_date" required />
        <Select
          label="שכבה"
          name="grade_id"
          required
          options={[
            { value: "", label: "בחרי" },
            ...yearData.grades.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
        <Select
          label="כיתה"
          name="class_id"
          required
          options={[
            { value: "", label: "בחרי" },
            ...yearData.classes.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          label="מסלול"
          name="track_id"
          required
          options={[
            { value: "", label: "בחרי" },
            ...yearData.tracks.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Select
          label="התמחות"
          name="specialization_id"
          options={[
            { value: "", label: "ללא" },
            ...yearData.specializations.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Button type="submit">בצע העברה</Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
