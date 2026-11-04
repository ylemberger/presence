"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncTeachersAction } from "../actions";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAccess } from "@/components/auth/AccessProvider";

export function TeachersForms() {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!canWrite) return null;

  async function handleSync() {
    setConfirmOpen(false);
    setError(null);
    setSummary(null);
    setLoading(true);
    try {
      const result = await syncTeachersAction();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "result" in result && result.result) {
        const r = result.result;
        setSummary(
          `נוספו ${r.teachersCreated} מורות, ${r.sourceRowsAdded} שיבוצי שכר חדשים, עודכנו ${r.sourceRowsUpdated ?? 0}. דולגו ${r.skippedInvalid} לא תקינים.`
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "סנכרון נכשל");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body-md text-body-md text-on-surface-variant">
        מורות נכנסות ממערכת השכר אחרי אישור שם. אי אפשר להוסיף מורה ידנית, ואי אפשר למחוק מורה.
        אחרי פתיחת שנה חדשה — לסנכרן רק כשמערכת השכר כבר מעודכנת לשנה החדשה.
      </p>
      <Button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="w-full"
      >
        <Icon name="sync" className="text-[20px]" />
        {loading ? "מסנכרן..." : "סנכרן ממערכת השכר"}
      </Button>
      {summary && (
        <p className="rounded-lg border border-primary/20 bg-secondary-container/40 px-3 py-2 text-body-md text-on-surface">
          {summary}
        </p>
      )}
      {error && (
        <p
          className="rounded-lg border border-error/20 bg-error-container/60 px-3 py-2 text-body-md text-on-error-container"
          role="alert"
        >
          {error}
        </p>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !loading && setConfirmOpen(false)}
        title="סנכרון ממערכת השכר"
        description="לפני שממשיכים"
        className="max-w-lg"
        dismissible={!loading}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="button" onClick={handleSync} disabled={loading}>
              {loading ? "מסנכרן..." : "כן, סנכרני"}
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface">
          בטוח שמערכת השכר כבר מעודכנת לשנה החדשה?
        </p>
        <p className="mt-3 text-body-sm text-on-surface-variant">
          הסנכרון קורא ממערכת השכר וכותב רק למערכת הנוכחות. אם השכר עדיין על השנה
          הקודמת, השיבוצים שייכנסו כאן יהיו של השנה הישנה.
        </p>
      </Modal>
    </div>
  );
}
