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
  soft: boolean;
  onResolved: () => void;
  onMarkAttendance: (gap: GapItem) => void;
}

export function AttendanceGapModal({ gap, soft, onResolved, onMarkAttendance }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "in_treatment" | "continued") {
    setBusy(true);
    setError(null);
    try {
      const result = await setOccurrenceGapHandlingAction(gap.occurrenceId, action);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onResolved();
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
      title="שיעור קודם ללא נוכחות"
      description={`${gap.subject} · ${formatHebrewDate(gap.date)} (${formatGregorianDate(gap.date)})`}
      onClose={() => {
        if (soft) onResolved();
      }}
      dismissible={soft}
      className="max-w-xl"
    >
      <div className="space-y-4">
        {soft ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            המופע עדיין מסומן כ«
            {gap.gapHandling === "in_treatment" ? "בטיפול" : "המשך למרות זאת"}
            ». אפשר להמשיך, או לטפל עכשיו.
          </p>
        ) : (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            לפני הזנת נוכחות לשיעורים אחרים יש לבחור פעולה למופע החסר הזה.
          </p>
        )}

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
            onClick={() => run("in_treatment")}
            className="justify-center py-3"
          >
            אין לי עדיין את הנתונים — תזכירי שוב
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => run("continued")}
            className="justify-center py-3 sm:col-span-2"
          >
            המשך בכל זאת (בלי למלא עכשיו)
          </Button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}
