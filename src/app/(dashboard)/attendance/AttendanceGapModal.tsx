"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";
import { setOccurrenceGapHandlingAction } from "../actions";

export type GapItem = {
  lessonId: string;
  subject: string;
  date: string;
  occurrenceId: string;
  gapHandling: "in_treatment" | "continued" | null;
};

interface Props {
  gap: GapItem;
  onResolved: (occurrenceId: string) => void;
  onMarkAttendance: (gap: GapItem) => void;
}

export function AttendanceGapModal({ gap, onResolved, onMarkAttendance }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "in_treatment" | "continued") {
    setBusy(true);
    setError(null);
    try {
      const result = await setOccurrenceGapHandlingAction(gap.occurrenceId, action);
      if (!result) {
        setError("הפעולה נכשלה. נסי שוב.");
        return;
      }
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onResolved(gap.occurrenceId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "פעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="תזכורת קלה"
      description={`${gap.subject} · ${formatHebrewDate(gap.date)} (${formatGregorianDate(gap.date)})`}
      onClose={() => onResolved(gap.occurrenceId)}
      dismissible={!busy}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-secondary/25 bg-secondary/5 px-4 py-3 text-sm text-on-surface">
          {gap.gapHandling === "in_treatment"
            ? "עדיין ממתין לרישום מהמופע הקודם של אותו שיעור. אפשר למלא עכשיו, או להמשיך ולחזור מאוחר יותר."
            : "לשיעור הזה יש מופע קודם שעדיין בלי נוכחות מלאה. אפשר למלא אותו עכשיו — או להמשיך בלי לחסום את עצמך."}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => onMarkAttendance(gap)}
            className="justify-center py-3"
          >
            למלא נוכחות עכשיו
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void run("continued")}
            className="justify-center py-3"
          >
            {busy ? "שומר…" : "המשך למופע הנוכחי"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void run("in_treatment")}
            className="justify-center py-3 sm:col-span-2"
          >
            {busy ? "שומר…" : "אין לי עדיין את הנתונים — תזכירי שוב"}
          </Button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => onResolved(gap.occurrenceId)}
          className="w-full text-center font-caption text-caption text-on-surface-variant underline-offset-2 hover:underline disabled:opacity-50"
        >
          סגירה בינתיים
        </button>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}
