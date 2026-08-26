"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updateStudentPersonalNoteAction } from "../../actions";

export function StudentPersonalNote({
  studentId,
  note,
}: {
  studentId: string;
  note: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("student_id", studentId);
      const result = await updateStudentPersonalNoteAction(fd);
      if (result?.error) {
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="personal_note" className="font-label-md text-label-md text-on-surface">
        הערה אישית
      </label>
      <textarea
        id="personal_note"
        name="personal_note"
        rows={4}
        maxLength={2000}
        defaultValue={note ?? ""}
        placeholder="משהו חשוב לדעת על התלמידה…"
        className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface shadow-tactile-sm placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "שומר..." : "שמירת הערה"}
        </Button>
        {saved && <p className="font-body-md text-body-md text-primary">נשמר.</p>}
        {error && (
          <p className="font-body-md text-body-md text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
