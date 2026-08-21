"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { upsertMakeupExamAction, updateMakeupExamAction } from "../actions";

interface Props {
  yearId: string;
  students: { id: string; full_name: string }[];
  lessons: { id: string; subject: string }[];
  preset?: { studentId: string; lessonId: string; requiredExams: number };
  editId?: string;
  editDefaults?: {
    required_exams: number;
    completed_exams: number;
    status: string;
    notes: string;
  };
  compact?: boolean;
}

export function MakeupForms({
  yearId,
  students,
  lessons,
  preset,
  editId,
  editDefaults,
  compact,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      if (preset) {
        fd.set("student_id", preset.studentId);
        fd.set("lesson_id", preset.lessonId);
        fd.set("required_exams", String(preset.requiredExams));
      }
      const result = editId
        ? await updateMakeupExamAction(editId, fd)
        : await upsertMakeupExamAction(fd);
      if (result && "error" in result && result.error) setError(result.error);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (editId && editDefaults) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <Input
          label={compact ? undefined : "נדרש"}
          name="required_exams"
          type="number"
          min={1}
          max={4}
          defaultValue={editDefaults.required_exams}
          className="w-20"
        />
        <Input
          label={compact ? undefined : "הושלם"}
          name="completed_exams"
          type="number"
          min={0}
          max={4}
          defaultValue={editDefaults.completed_exams}
          className="w-20"
        />
        <Select
          label={compact ? undefined : "סטטוס"}
          name="status"
          defaultValue={editDefaults.status}
          options={[
            { value: "open", label: "פתוח" },
            { value: "done", label: "הושלם" },
            { value: "blocked", label: "חסום" },
          ]}
        />
        <Button type="submit" size="sm" disabled={loading}>
          עדכון
        </Button>
        {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      </form>
    );
  }

  if (preset) {
    return (
      <form onSubmit={handleSubmit}>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "..." : "פתחי"}
        </Button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="תלמידה"
        name="student_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...students.map((s) => ({ value: s.id, label: s.full_name })),
        ]}
      />
      <Select
        label="שיעור"
        name="lesson_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...lessons.map((l) => ({ value: l.id, label: l.subject })),
        ]}
      />
      <Input label="מספר מבחנים" name="required_exams" type="number" min={1} max={4} defaultValue={1} />
      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-rose-600">{error}</p>}
    </form>
  );
}
