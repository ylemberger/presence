"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { createOccurrenceAction } from "../actions";

export function AddOccurrenceDate({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("lesson_id", lessonId);
      const result = await createOccurrenceAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "date" in result && result.date) {
        const occ = "occurrenceId" in result ? result.occurrenceId : "";
        router.push(
          `/attendance?date=${encodeURIComponent(result.date)}${occ ? `&occurrenceId=${encodeURIComponent(occ)}` : ""}`
        );
        router.refresh();
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הוספה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        הוספת תאריך ידני
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
      <HebrewDateInput label="תאריך נוסף לשיעור" name="occurrence_date" required />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "מוסיף..." : "הוספה"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          ביטול
        </Button>
      </div>
      {error && (
        <p className="font-caption text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
