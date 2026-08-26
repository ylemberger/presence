"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { updateStudentPersonalNoteAction } from "../../actions";

export function StudentPersonalNote({
  studentId,
  note,
  compact = false,
}: {
  studentId: string;
  note: string | null;
  /** Compact editor under the name in the header */
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

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
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (compact && !editing) {
    return (
      <div className="mt-2 max-w-xl">
        {note ? (
          <p className="rounded-lg border border-secondary/25 bg-secondary-container/40 px-3 py-2 font-body-sm text-body-sm text-on-surface">
            <Icon name="sticky_note_2" className="me-1 inline align-text-bottom text-[16px] text-secondary" />
            {note}
          </p>
        ) : (
          <p className="font-caption text-caption text-on-surface-variant">אין הערה אישית</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 font-label-md text-label-md text-secondary hover:underline"
        >
          {note ? "עריכת הערה" : "הוספת הערה אישית"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "mt-2 max-w-xl space-y-2" : "flex flex-col gap-3"}>
      {!compact && (
        <label htmlFor="personal_note" className="font-label-md text-label-md text-on-surface">
          הערה אישית
        </label>
      )}
      <textarea
        id="personal_note"
        name="personal_note"
        rows={compact ? 2 : 4}
        maxLength={2000}
        defaultValue={note ?? ""}
        autoFocus={compact}
        placeholder="משהו חשוב לדעת על התלמידה…"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface shadow-tactile-sm placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "שומר..." : "שמירה"}
        </Button>
        {compact && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
            ביטול
          </Button>
        )}
        {saved && <p className="font-body-sm text-body-sm text-primary">נשמר.</p>}
        {error && (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
