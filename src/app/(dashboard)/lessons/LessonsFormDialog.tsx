"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { LessonsForm, type LessonsFormProps } from "./LessonsForm";

interface LessonsFormDialogProps extends LessonsFormProps {
  startOpen?: boolean;
  noTeachers?: boolean;
  editNotFound?: boolean;
}

export function LessonsFormDialog({
  startOpen = false,
  noTeachers = false,
  editNotFound = false,
  cancelHref,
  initial,
  ...formProps
}: LessonsFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [mounted, setMounted] = useState(false);
  const editing = Boolean(initial);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);

  function close() {
    setOpen(false);
    if (startOpen && cancelHref) {
      router.push(cancelHref);
    }
  }

  const modal = (
    <Modal
      open={open}
      title={editing ? "עריכת שיעור" : "יצירת שיעור חדש"}
      description={
        editing
          ? "שינוי הטווח או היום יעדכן את המופעים העתידיים לפי ההגדרות החדשות."
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
        <LessonsForm
          key={initial?.id ?? "create"}
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
        <Icon name="add" className="text-[18px]" />
        {editing ? "עריכת שיעור" : "יצירת שיעור"}
      </Button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
