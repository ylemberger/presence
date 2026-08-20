"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { syncTeachersAction } from "../actions";

interface SyncButtonProps {
  academicYearId: string;
}

export function SyncButton({ academicYearId }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    const result = await syncTeachersAction(academicYearId);
    if (result.error) {
      setMessage(`שגיאה: ${result.error}`);
    } else if (result.result) {
      const r = result.result;
      setMessage(
        `נוצרו ${r.teachersCreated} מורות, עודכנו ${r.teachersUpdated}, נוצרו ${r.assignmentsCreated} שיבוצים, דולגו ${r.skipped}`
      );
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div>
      <Button onClick={handleSync} disabled={loading}>
        {loading ? "מסנכרן..." : "סנכרון ממקור חיצוני"}
      </Button>
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
