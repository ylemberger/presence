"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { DeleteButton } from "@/components/ui/DeleteButton";
import {
  createStudentLessonAssignmentAction,
  deleteStudentLessonAssignmentAction,
} from "../../actions";
import { formatDate } from "@/lib/dates/hebrew";
import { Icon } from "@/components/ui/Icon";

interface LessonOption {
  id: string;
  subject: string;
}

interface AssignmentRow {
  id: string;
  lesson_id: string;
  subject: string;
  assignment_type: string;
  start_date: string;
  end_date: string | null;
}

export function StudentLessonAssignments({
  studentId,
  lessons,
  assignments,
}: {
  studentId: string;
  lessons: LessonOption[];
  assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);

  async function submit(fd: FormData, force: boolean) {
    if (force) fd.set("force_mismatch", "1");
    else fd.delete("force_mismatch");

    const result = await createStudentLessonAssignmentAction(fd);
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
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("student_id", studentId);
    const ok = await submit(fd, false);
    if (ok) form.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-caption text-caption text-on-surface-variant">
        שיוך אוטומטי נוצר כשפותחים שיעור לקבוצה של התלמידה. כאן אפשר להוסיף שיוך ידני חריג.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Select
          label="שיעור"
          name="lesson_id"
          required
          options={[
            { value: "", label: "בחרי שיעור" },
            ...lessons.map((l) => ({ value: l.id, label: l.subject })),
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <HebrewDateInput label="מתאריך" name="start_date" required />
          <HebrewDateInput label="עד תאריך" name="end_date" allowEmpty />
        </div>
        <Button type="submit" className="mt-2 w-full">
          <Icon name="add" className="text-[18px]" />
          שיוך לשיעור
        </Button>
      </form>
      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
      {mismatchWarning && pendingForm && (
        <div className="rounded-xl border border-attendance-late/30 bg-attendance-late/10 px-4 py-3 font-body-sm text-body-sm text-attendance-late">
          <p className="mb-2">{mismatchWarning}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => submit(pendingForm, true)}
          >
            שמרי בכל זאת
          </Button>
        </div>
      )}
      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-6 text-center font-body-md text-body-md text-on-surface-variant">
          אין שיוכים לשיעורים עדיין.
        </div>
      ) : (
        <ul className="flex flex-col gap-2 font-body-md text-body-md">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="group flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 transition-colors hover:border-secondary/50"
            >
              <div className="min-w-0">
                <div className="font-semibold text-on-surface">{a.subject}</div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {a.assignment_type === "manual" ? "ידני" : "אוטומטי"} ·{" "}
                  {formatDate(a.start_date)} →{" "}
                  {a.end_date ? formatDate(a.end_date) : "פתוח"}
                </div>
              </div>
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <DeleteButton
                  onDelete={() => deleteStudentLessonAssignmentAction(a.id, studentId)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
