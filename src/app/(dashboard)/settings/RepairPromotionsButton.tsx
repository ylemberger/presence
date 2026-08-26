"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { repairMissingPromotionsAction } from "@/app/(dashboard)/actions";

export function RepairPromotionsButton({
  missingCount,
  previousYearName,
}: {
  missingCount?: number;
  previousYearName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await repairMissingPromotionsAction();
      if (res?.error) {
        setError(res.error);
        return;
      }
      const r = res.result;
      setMessage(
        `שוחזרו ${r?.promoted ?? 0} שיבוצים` +
          (r?.graduated ? `, ${r.graduated} עברו לארכיון` : "") +
          (r?.skipped ? `, ${r.skipped} דולגו` : "") +
          "."
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-body-sm text-on-surface-variant">
        אם בקידום שנה נעלמו שכבה/כיתה/מסלול/התמחות — השחזור בונה אותם מחדש מהשנה
        הקודמת לפי הכללים (א→ב יג→יד, ב→ג לכיתה «שנה ג»).
        {previousYearName ? ` מקור: ${previousYearName}.` : ""}
        {typeof missingCount === "number" ? ` חסרים כעת כ־${missingCount}.` : ""}
      </p>
      <Button type="button" onClick={run} disabled={pending} variant="secondary">
        <Icon name="history" className="text-[18px]" />
        {pending ? "משחזר..." : "שחזר שיבוצים מהשנה הקודמת"}
      </Button>
      {message && (
        <p className="rounded-lg bg-secondary-container/50 px-3 py-2 text-body-sm text-on-secondary-container">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
