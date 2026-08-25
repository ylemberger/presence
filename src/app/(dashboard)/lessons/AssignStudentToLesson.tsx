"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { createStudentLessonAssignmentAction } from "../actions";
import { Icon } from "@/components/ui/Icon";

export function AssignStudentToLesson({
  lessonId,
  students,
  defaultStartDate,
}: {
  lessonId: string;
  students: { id: string; full_name: string }[];
  defaultStartDate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(fd: FormData, force: boolean) {
    fd.set("lesson_id", lessonId);
    if (force) fd.set("force_mismatch", "1");
    else fd.delete("force_mismatch");
    setSaving(true);
    const result = await createStudentLessonAssignmentAction(fd);
    setSaving(false);
    if (result && "error" in result && result.error) {
      if ("code" in result && result.code === "mismatch") {
        setMismatchWarning(result.error);
        setPendingForm(fd);
        setError(null);
        return false;
      }
      setError(result.error);
      setMismatchWarning(null);
      setPendingForm(null);
      return false;
    }
    setError(null);
    setMismatchWarning(null);
    setPendingForm(null);
    setOpen(false);
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await submit(fd, false);
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="person_add" className="text-[18px]" />
        שייך תלמידה
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-outline-variant/40 bg-surface-container-low/70 p-3 text-right"
    >
      <p className="mb-2 font-caption text-caption text-on-surface-variant">
        אפשר לשייך גם תלמידה שאינה בכיתה/מסלול של השיעור. תופיע אזהרה לפני השמירה, והשיעור ייספר
        כחיוב שלה בדוח.
      </p>
      <Combobox
        label="תלמידה"
        name="student_id"
        required
        options={students.map((s) => ({ value: s.id, label: s.full_name }))}
        emptyLabel="בחרי תלמידה"
      />
      <div className="mt-2">
        <HebrewDateInput label="בתוקף מתאריך" name="start_date" required defaultValue={defaultStartDate} />
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
      {mismatchWarning && pendingForm && (
        <div className="mt-2 rounded-xl border border-attendance-late/30 bg-attendance-late/10 px-3 py-2 font-body-sm text-body-sm text-attendance-late">
          <p className="mb-2">{mismatchWarning}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => submit(pendingForm, true)}
          >
            שמרי בכל זאת
          </Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "שומרת…" : "שמירה"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
