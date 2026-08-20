"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  createStudentAssignmentAction,
  transferStudentAction,
} from "../../actions";
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

function AssignmentFields({
  yearData,
  prefix,
}: {
  yearData: YearData;
  prefix: string;
}) {
  return (
    <>
      <Select
        label="שכבה"
        name={`${prefix}grade_id`}
        required
        options={[
          { value: "", label: "בחרי" },
          ...yearData.grades.map((g) => ({ value: g.id, label: g.name })),
        ]}
      />
      <Select
        label="כיתה"
        name={`${prefix}class_id`}
        required
        options={[
          { value: "", label: "בחרי" },
          ...yearData.classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="מגמה"
        name={`${prefix}track_id`}
        required
        options={[
          { value: "", label: "בחרי" },
          ...yearData.tracks.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />
      <Select
        label="התמחות"
        name={`${prefix}specialization_id`}
        options={[
          { value: "", label: "ללא" },
          ...yearData.specializations.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
    </>
  );
}

export function StudentDetailForms({ studentId, yearData }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"assign" | "transfer">("assign");

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("student_id", studentId);
    fd.set("academic_year_id", yearData.year.id);
    const result = await createStudentAssignmentAction(fd);
    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("student_id", studentId);
    fd.set("academic_year_id", yearData.year.id);
    const result = await transferStudentAction(fd);
    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button
          variant={mode === "assign" ? "primary" : "secondary"}
          size="sm"
          type="button"
          onClick={() => setMode("assign")}
        >
          שיבוץ חדש
        </Button>
        <Button
          variant={mode === "transfer" ? "primary" : "secondary"}
          size="sm"
          type="button"
          onClick={() => setMode("transfer")}
        >
          העברה
        </Button>
      </div>

      {mode === "assign" ? (
        <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3">
          <AssignmentFields yearData={yearData} prefix="" />
          <Input label="תאריך התחלה" name="start_date" type="date" required />
          <Input label="תאריך סיום (אופציונלי)" name="end_date" type="date" />
          <Button type="submit">שמור שיבוץ</Button>
        </form>
      ) : (
        <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-3">
          <Input label="תאריך העברה" name="transfer_date" type="date" required />
          <AssignmentFields yearData={yearData} prefix="" />
          <Button type="submit">בצע העברה</Button>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
