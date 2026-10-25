"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ActionSubmitButton } from "@/components/ui/ActionSubmitButton";
import { Combobox } from "@/components/ui/Combobox";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { useAccess } from "@/components/auth/AccessProvider";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { reassignOccurrenceLessonAction } from "../actions";

type LessonOption = {
  id: string;
  subject: string;
  teacherName?: string;
  groupLabel?: string;
  day_of_week?: number;
  lesson_number?: number;
  period_count?: number;
};

export function ReassignOccurrenceLesson({
  occurrenceIds,
  currentLessonId,
  occurrenceDate,
  lessons,
}: {
  occurrenceIds: string[];
  currentLessonId: string;
  occurrenceDate: string;
  lessons: LessonOption[];
}) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetLessonId, setTargetLessonId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const options = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.id !== currentLessonId)
        .map((lesson) => ({
          value: lesson.id,
          label: [lesson.subject, lesson.teacherName, lesson.groupLabel]
            .filter(Boolean)
            .join(" · "),
          description: formatLessonOptionLabel({
            subject: lesson.subject,
            day_of_week: lesson.day_of_week,
            lesson_number: lesson.lesson_number,
            period_count: lesson.period_count,
          }),
          keywords: [lesson.subject, lesson.teacherName, lesson.groupLabel]
            .filter(Boolean)
            .join(" "),
        })),
    [lessons, currentLessonId]
  );

  if (!canWrite || occurrenceIds.length === 0) return null;

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setSaved(false);
    setTargetLessonId("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaved(false);
    if (!targetLessonId) {
      setError("יש לבחור שיעור יעד מהרשימה");
      return;
    }
    setSaving(true);
    try {
      const result = await reassignOccurrenceLessonAction({
        occurrenceIds,
        targetLessonId,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      const occ =
        result && "occurrenceId" in result && result.occurrenceId
          ? result.occurrenceId
          : occurrenceIds[0];
      const nextLesson =
        result && "lessonId" in result && result.lessonId ? result.lessonId : targetLessonId;
      const params = new URLSearchParams();
      if (occurrenceDate) params.set("date", occurrenceDate);
      if (occ) params.set("occurrenceId", occ);
      if (nextLesson) params.set("lessonId", nextLesson);
      router.push(`/attendance?${params.toString()}`, { scroll: false });
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setTargetLessonId("");
      }, 900);
    } catch {
      setError("העברת המופע נכשלה. לא נשמר.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="edit" className="text-[16px]" />
        עריכת שיעור
      </Button>
      <Modal
        open={open}
        title="עריכת שיעור למופע זה"
        description="רק המופע הפתוח יועבר לשיעור אחר. שאר המפגשים של השיעור המקורי נשארים. הסימונים נשארים ונספרים לשיעור היעד."
        onClose={close}
        dismissible={!saving}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <Combobox
            label="שיעור יעד"
            name="target_lesson_id"
            value={targetLessonId}
            onChange={setTargetLessonId}
            options={options}
            placeholder="חיפוש לפי מקצוע, מורה או קבוצה"
            emptyLabel="אין שיעור אחר בשנה הזו"
            required
          />
          {error && (
            <p className="font-caption text-caption text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={close} disabled={saving}>
              ביטול
            </Button>
            <ActionSubmitButton
              size="sm"
              loading={saving}
              saved={saved}
              idleLabel="העבירי מופע זה"
              loadingLabel="מעבירה…"
              savedLabel="נשמר"
              disabled={!targetLessonId}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
