"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/auth/AccessProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { LessonsForm, type LessonsFormProps } from "./LessonsForm";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import Link from "next/link";

interface LessonsFormDialogProps extends LessonsFormProps {
  startOpen?: boolean;
  noTeachers?: boolean;
  editNotFound?: boolean;
  editLocked?: boolean;
  markedMeetings?: { id: string; date: string }[];
}

export function LessonsFormDialog({
  startOpen = false,
  noTeachers = false,
  editNotFound = false,
  editLocked = false,
  markedMeetings = [],
  cancelHref,
  initial,
  ...formProps
}: LessonsFormDialogProps) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const editToken = initial?.id ?? (startOpen ? "missing" : "create");
  const [open, setOpen] = useState(startOpen);
  const [mounted, setMounted] = useState(false);
  const editing = Boolean(initial);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Re-open whenever the URL asks to edit (including switching between lessons).
  useLayoutEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen, editToken]);

  if (!canWrite) return null;

  function close() {
    setOpen(false);
    if (startOpen && cancelHref) {
      router.push(cancelHref, { scroll: false });
    }
  }

  const modal = (
    <Modal
      open={open}
      title={editing ? "עריכת שיעור" : "יצירת שיעור חדש"}
      description={
        editing
          ? editLocked
            ? "העריכה נעולה כי יש מפגשים עם נוכחות. אפסי אותם, ואז אפשר לשנות קהל יעד ושאר פרטים."
            : "כל נתוני השיעור נטענים לעריכה. השמירה מעדכנת מופעים ושיוכי תלמידות, כל עוד עדיין אין נוכחות."
          : "יצירת שיעור פותחת אוטומטית את המופעים בטווח שנבחר. ימי חופשה לא נכללים."
      }
      onClose={close}
      className="max-w-5xl"
    >
      {noTeachers && (
        <p className="mb-3 rounded-lg bg-attendance-late/10 px-4 py-3 font-body-lg text-body-lg text-attendance-late">
          אין מורות במערכת.{" "}
          <a href="/teachers" className="font-semibold underline">
            הוסיפי מורה
          </a>{" "}
          לפני יצירת שיעור.
        </p>
      )}
      {editNotFound ? (
        <p className="rounded-lg bg-error-container/60 px-4 py-3 font-body-md text-body-md text-on-error-container">
          השיעור לעריכה לא נמצא.
        </p>
      ) : editLocked ? (
        <div className="rounded-lg bg-surface-container-low px-4 py-3 font-body-md text-body-md text-on-surface">
          <p>
            אי אפשר לשנות את השיעור כל עוד יש מפגש עם נוכחות. העריכה לא מוחקת
            סימונים. אפסי נוכחות בכל המפגשים האלה, ואז העריכה תיפתח.
          </p>
          {markedMeetings.length > 0 ? (
            <ul className="mt-3 flex max-h-48 flex-col gap-1 overflow-auto">
              {markedMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/attendance?date=${encodeURIComponent(meeting.date)}&occurrenceId=${encodeURIComponent(meeting.id)}`}
                    className="font-semibold text-secondary hover:underline"
                  >
                    {formatHebrewDate(meeting.date)} — אפסי נוכחות
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <LessonsForm
          key={editToken}
          {...formProps}
          initial={initial}
          cancelHref={editing ? cancelHref : undefined}
          onCreated={close}
          onCancel={close}
        />
      )}
    </Modal>
  );

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Icon name={editing ? "edit" : "add"} className="text-[18px]" />
        {editing ? "עריכת שיעור" : "יצירת שיעור"}
      </Button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
