"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionSubmitButton } from "@/components/ui/ActionSubmitButton";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { upsertMakeupExamAction, updateMakeupExamAction } from "../actions";
import { useAccess } from "@/components/auth/AccessProvider";

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
  const { canWrite } = useAccess();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!canWrite) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setSaved(false);
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
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
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
        <ActionSubmitButton
          size="sm"
          loading={loading}
          saved={saved}
          idleLabel="עדכון"
          loadingLabel="שומרת…"
          savedLabel="נשמר"
          idleIcon="save"
        />
        {error && (
          <p className="w-full rounded-lg bg-error-container/60 px-2 py-1 font-caption text-caption text-on-error-container">
            {error}
          </p>
        )}
      </form>
    );
  }

  if (preset) {
    return (
      <form onSubmit={handleSubmit}>
        <ActionSubmitButton
          size="sm"
          loading={loading}
          saved={saved}
          idleLabel="שבץ"
          loadingLabel="שומרת…"
          savedLabel="נשמר"
          idleIcon="playlist_add"
        />
        {error && (
          <p className="mt-1 font-caption text-caption text-error">{error}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Combobox
        label="תלמידה"
        name="student_id"
        required
        options={students.map((s) => ({ value: s.id, label: s.full_name }))}
        emptyLabel="בחרי תלמידה"
      />
      <Combobox
        label="שיעור"
        name="lesson_id"
        required
        options={lessons.map((l) => ({ value: l.id, label: l.subject }))}
        emptyLabel="בחרי שיעור"
      />
      <Input
        label="מספר מבחנים"
        name="required_exams"
        type="number"
        min={1}
        max={4}
        defaultValue={1}
      />
      <ActionSubmitButton
        className="mt-1 w-full"
        loading={loading}
        saved={saved}
        idleLabel="צור מבחן"
        loadingLabel="שומרת…"
        savedLabel="נשמר"
        idleIcon="post_add"
      />
      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </form>
  );
}
