"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncTeachersAction } from "../actions";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export function TeachersForms() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSync() {
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
      </p>
      <Button type="button" onClick={handleSync} disabled={loading} className="w-full">
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
    </div>
  );
}
