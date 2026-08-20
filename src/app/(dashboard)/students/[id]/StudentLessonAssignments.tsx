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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("student_id", studentId);
    const result = await createStudentLessonAssignmentAction(fd);
    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <Select
          label="שיעור"
          name="lesson_id"
          required
          options={[
            { value: "", label: "בחרי שיעור" },
            ...lessons.map((l) => ({ value: l.id, label: l.subject })),
          ]}
        />
        <Select
          label="סוג שיוך"
          name="assignment_type"
          defaultValue="manual"
          options={[
            { value: "manual", label: "ידני" },
            { value: "automatic", label: "אוטומטי" },
          ]}
        />
        <HebrewDateInput label="מתאריך" name="start_date" required />
        <HebrewDateInput label="עד תאריך" name="end_date" allowEmpty />
        <Button type="submit">שיוך לשיעור</Button>
      </form>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/90">
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">מקצוע</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">סוג</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">מתאריך</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">עד תאריך</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assignments.map((a) => (
              <tr key={a.id} className="hover:bg-stone-50/80">
                <td className="px-4 py-3 text-right">{a.subject}</td>
                <td className="px-4 py-3 text-right">
                  {a.assignment_type === "manual" ? "ידני" : "אוטומטי"}
                </td>
                <td className="px-4 py-3 text-right">{formatDate(a.start_date)}</td>
                <td className="px-4 py-3 text-right">
                  {a.end_date ? formatDate(a.end_date) : "פתוח"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    onDelete={() => deleteStudentLessonAssignmentAction(a.id, studentId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignments.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">אין שיוכים לשיעורים עדיין.</p>
        )}
      </div>
    </div>
  );
}
