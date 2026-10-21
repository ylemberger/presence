"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { DeleteButton } from "@/components/ui/DeleteButton";
import {
  createStudentLessonAssignmentAction,
  deleteStudentLessonAssignmentAction,
} from "../../actions";
import { formatDate, todayIso } from "@/lib/dates/hebrew";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { Icon } from "@/components/ui/Icon";

interface LessonOption {
  id: string;
  subject: string;
  day_of_week?: number;
  lesson_number?: number;
  period_count?: number;
  billing_type?: string;
}

interface AssignmentRow {
  id: string;
  lesson_id: string;
  subject: string;
  assignment_type: string;
  start_date: string;
  end_date: string | null;
}

import { useAccess } from "@/components/auth/AccessProvider";

export function StudentLessonAssignments({
  studentId,
  lessons,
  assignments,
}: {
  studentId: string;
  lessons: LessonOption[];
  assignments: AssignmentRow[];
}) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const today = todayIso();
  const currentAssignments = assignments.filter(
    (a) => !a.end_date || a.end_date.slice(0, 10) >= today
  );
  const pastAssignments = assignments.filter(
    (a) => a.end_date && a.end_date.slice(0, 10) < today
  );

  async function submit(fd: FormData, force: boolean) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    if (force) fd.set("force_mismatch", "1");
    else fd.delete("force_mismatch");

    let result: Awaited<ReturnType<typeof createStudentLessonAssignmentAction>>;
    try {
      result = await createStudentLessonAssignmentAction(fd);
    } catch {
      savingRef.current = false;
      setSaving(false);
      setError("לא ניתן לשייך את התלמידה לשיעור");
      setMismatchWarning(null);
      setPendingForm(null);
      return false;
    }
    savingRef.current = false;
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

  function removeLink(assignmentId: string) {
    return deleteStudentLessonAssignmentAction(assignmentId, studentId);
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
      <p className="font-caption text-caption text-on-surface-variant">
        אפשר לשייך לשיעור ספציפי פעם אחת. שיוך שכבר קיים לא נשמר שוב. «הסר שיוך» מוריד את השורה הזו. התלמידה ונוכחות שכבר סומנה נשארות.
      </p>
      ) : null}
      {canWrite ? (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Combobox
          label="הוספת שיוך לשיעור"
          name="lesson_id"
          required
          options={lessons.map((l) => ({ value: l.id, label: formatLessonOptionLabel(l) }))}
          emptyLabel="בחרי שיעור"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <HebrewDateInput label="מתאריך" name="start_date" required />
          <HebrewDateInput label="עד תאריך" name="end_date" allowEmpty />
        </div>
        <Button type="submit" className="mt-2 w-full" disabled={saving}>
          <Icon name="add" className="text-[18px]" />
          {saving ? "שומרת…" : "שיוך לשיעור"}
        </Button>
      </form>
      ) : null}

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
          {currentAssignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-on-surface">{a.subject}</div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {a.assignment_type === "manual" ? "ידני" : "אוטומטי"} · {formatDate(a.start_date)} →{" "}
                  {a.end_date ? formatDate(a.end_date) : "פתוח"}
                </div>
              </div>
              {canWrite ? (
                <DeleteButton
                  label="הסר שיוך"
                  confirmMessage="יוסר השיוך הזה לשיעור. נוכחות שכבר סומנה נשארת, והתלמידה לא נמחקת."
                  onDelete={() => removeLink(a.id)}
                />
              ) : null}
            </li>
          ))}
          {pastAssignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 text-on-surface-variant"
            >
              <div className="min-w-0">
                <div className="font-semibold">{a.subject}</div>
                <div className="font-caption text-caption">
                  {a.assignment_type === "manual" ? "ידני" : "אוטומטי"} · {formatDate(a.start_date)} →{" "}
                  {a.end_date ? formatDate(a.end_date) : "פתוח"}
                </div>
              </div>
              {canWrite && a.assignment_type === "manual" ? (
                <DeleteButton
                  label="הסר שיוך"
                  confirmMessage="יוסר השיוך הזה לשיעור. נוכחות שכבר סומנה נשארת, והתלמידה לא נמחקת."
                  onDelete={() => removeLink(a.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
