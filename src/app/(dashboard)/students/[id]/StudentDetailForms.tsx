"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { transferStudentAction } from "../../actions";
import type {
  AcademicYear,
  Grade,
  Class,
  Track,
  Specialization,
} from "@/types/database";

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
  const [gradeId, setGradeId] = useState("");
  const [classId, setClassId] = useState("");

  const gradeNameById = useMemo(
    () => new Map(yearData.grades.map((g) => [g.id, g.name])),
    [yearData.grades]
  );

  const classOptions = useMemo(() => {
    const list = gradeId
      ? yearData.classes.filter((c) => c.grade_id === gradeId)
      : yearData.classes;
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        value: c.id,
        label: gradeId
          ? c.name
          : `${gradeNameById.get(c.grade_id) ?? "?"} · ${c.name}`,
      }));
  }, [yearData.classes, gradeId, gradeNameById]);

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("student_id", studentId);
      fd.set("academic_year_id", yearData.year.id);
      if (gradeId) fd.set("grade_id", gradeId);
      if (classId) fd.set("class_id", classId);
      const result = await transferStudentAction(fd);
      if (result && "error" in result && result.error) setError(result.error);
      else {
        form.reset();
        setGradeId("");
        setClassId("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "העברה נכשלה");
    }
  }

  return (
    <div>
      <p className="mb-3 font-caption text-caption text-on-surface-variant">
        שינוי כיתה/מסלול/התמחות/פסיכולוגיה נעשה רק בהעברה. השיבוץ הקודם נסגר ונשמר בהיסטוריה.
      </p>
      <form onSubmit={handleTransfer} className="flex flex-col gap-3">
        <HebrewDateInput label="בתוקף מתאריך" name="transfer_date" required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setClassId("");
            }}
            options={[
              { value: "", label: "בחרי" },
              ...yearData.grades.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <Select
            label="כיתה"
            name="class_id"
            required
            value={classId}
            onChange={(e) => {
              const next = e.target.value;
              setClassId(next);
              const selected = yearData.classes.find((c) => c.id === next);
              if (selected && selected.grade_id !== gradeId) {
                setGradeId(selected.grade_id);
              }
            }}
            options={[
              {
                value: "",
                label: classOptions.length ? "בחרי" : "אין כיתות בהגדרות",
              },
              ...classOptions,
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
          <Select
            label="התמחות נוספת"
            name="secondary_specialization_id"
            options={[
              { value: "", label: "ללא" },
              ...yearData.specializations.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            name="is_psychology"
            className="rounded border-outline-variant"
          />
          פסיכולוגיה
        </label>
        <Button type="submit" className="mt-2 w-full">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            move_up
          </span>
          בצע העברה
        </Button>
      </form>
      {error && (
        <p className="mt-3 rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
