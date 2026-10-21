"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/auth/AccessProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { LessonsForm, type LessonsFormProps } from "./LessonsForm";
import { ResetLessonAttendanceButton } from "./ResetLessonAttendanceButton";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import Link from "next/link";

interface LessonsFormDialogProps extends LessonsFormProps {
  startOpen?: boolean;
  noTeachers?: boolean;
  editNotFound?: boolean;
  attendanceRecorded?: boolean;
  markedMeetings?: { id: string; date: string }[];
}

export function LessonsFormDialog({
  startOpen = false,
  noTeachers = false,
  editNotFound = false,
  attendanceRecorded = false,
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
          ? attendanceRecorded
            ? "אפשר לשנות שם, מורה, כלל נוכחות וטווח. קהל יעד, יום ושעה נשארים כל עוד יש נוכחות. טווח חדש חייב לכלול כל מפגש שסומן."
            : "כל נתוני השיעור נטענים לעריכה. השמירה מעדכנת מופעים ושיוכי תלמידות."
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
      ) : (
        <>
          {attendanceRecorded && markedMeetings.length > 0 ? (
            <div className="mb-3 rounded-lg bg-surface-container-low px-4 py-3 font-body-md text-body-md text-on-surface">
              <p>
                יש נוכחות במפגשים האלה. העריכה לא מוחקת סימונים. כדי לשנות קהל יעד, יום או שעה, אפסי קודם את הנוכחות.
              </p>
              {initial?.id ? (
                <div className="mt-3">
                  <ResetLessonAttendanceButton lessonId={initial.id} />
                </div>
              ) : null}
              <ul className="mt-3 flex max-h-36 flex-col gap-1 overflow-auto">
                {markedMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/attendance?date=${encodeURIComponent(meeting.date)}&occurrenceId=${encodeURIComponent(meeting.id)}`}
                      className="font-semibold text-secondary hover:underline"
                    >
                      {formatHebrewDate(meeting.date)} — אפסי את המפגש
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <LessonsForm
            key={editToken}
            {...formProps}
            initial={initial}
            attendanceRecorded={attendanceRecorded}
            cancelHref={editing ? cancelHref : undefined}
            onCreated={close}
            onCancel={close}
          />
        </>
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
