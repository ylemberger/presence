"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { createStudentAction } from "../actions";
import type { Grade, Class, Track, Specialization } from "@/types/database";

interface StudentsFormProps {
  yearId: string;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
}

export function StudentsForm({
  yearId,
  grades,
  classes,
  tracks,
  specializations,
}: StudentsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gradeId, setGradeId] = useState("");

  const filteredClasses = classes.filter((c) => !gradeId || c.grade_id === gradeId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("academic_year_id", yearId);
    const result = await createStudentAction(fd);
    if (result && "error" in result && result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      setGradeId("");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Input label="שם מלא" name="full_name" required />
      <Input label='ת"ז' name="identity_number" required />
      <Select
        label="שכבה"
        name="grade_id"
        required
        value={gradeId}
        onChange={(e) => setGradeId(e.target.value)}
        options={[
          { value: "", label: "בחרי" },
          ...grades.map((g) => ({ value: g.id, label: g.name })),
        ]}
      />
      <Select
        label="כיתה"
        name="class_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...filteredClasses.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="מסלול"
        name="track_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...tracks.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />
      <Select
        label="התמחות"
        name="specialization_id"
        options={[
          { value: "", label: "ללא" },
          ...specializations.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <HebrewDateInput label="בתוקף מתאריך" name="start_date" required />
      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספת תלמידה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
