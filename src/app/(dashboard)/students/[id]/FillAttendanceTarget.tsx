"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { fillAttendanceToTargetAction } from "../../actions";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { Icon } from "@/components/ui/Icon";

interface LessonOption {
  id: string;
  subject: string;
  day_of_week?: number;
  lesson_number?: number;
  period_count?: number;
}

interface AssignmentRow {
  lesson_id: string;
  end_date: string | null;
}

export function FillAttendanceTarget({
  studentId,
  lessons,
  assignments,
}: {
  studentId: string;
  lessons: LessonOption[];
  assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const [lessonId, setLessonId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignedLessonIds = useMemo(
    () => new Set(assignments.filter((a) => a.end_date == null).map((a) => a.lesson_id)),
    [assignments]
  );

  const options = useMemo(
    () =>
      lessons
        .filter((l) => assignedLessonIds.has(l.id))
        .map((l) => ({
          value: l.id,
          label: formatLessonOptionLabel(l),
        })),
    [lessons, assignedLessonIds]
  );

  function run(targetPercent: 80 | 100) {
    if (!lessonId) {
      setError("יש לבחור שיעור");
      return;
    }
    const label = options.find((o) => o.value === lessonId)?.label ?? "השיעור";
    const ok = window.confirm(
      `לסדר נוכחות ב«${label}» ל־${targetPercent}%?\n` +
        `מופעים לא מסומנים (ואם צריך גם היעדרויות) עד היום יסומנו כנוכחת.`
    );
    if (!ok) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fillAttendanceToTargetAction(studentId, lessonId, targetPercent);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const r = res && "result" in res ? res.result : null;
      if (r) {
        setMessage(
          r.marked === 0
            ? `כבר ב־${r.presencePercent}% (יעד ${r.targetPercent}%). לא נדרש שינוי.`
            : `סומנו ${r.marked} מופעים כנוכחת` +
                (r.convertedAbsent ? ` (מתוכן ${r.convertedAbsent} שהיו היעדרות)` : "") +
                `. כעת כ־${r.presencePercent}% מתוך ${r.total}.`
        );
      }
      router.refresh();
    });
  }

  if (options.length === 0) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        אין שיעורים משויכים — אי אפשר לסדר נוכחות אוטומטית.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-caption text-caption text-on-surface-variant">
        בוחרים שיעור ונותנים הוראה להשלים נוכחות ל־80% או 100% (מופעים עד היום בלבד).
      </p>
      <Combobox
        label="שיעור"
        value={lessonId}
        onChange={setLessonId}
        options={options}
        emptyLabel="בחרי שיעור"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !lessonId}
          onClick={() => run(80)}
        >
          <Icon name="tune" className="text-[18px]" />
          {pending ? "מסדר…" : "סדר ל־80%"}
        </Button>
        <Button type="button" disabled={pending || !lessonId} onClick={() => run(100)}>
          <Icon name="done_all" className="text-[18px]" />
          {pending ? "מסדר…" : "סדר ל־100%"}
        </Button>
      </div>
      {message && (
        <p className="rounded-lg bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
