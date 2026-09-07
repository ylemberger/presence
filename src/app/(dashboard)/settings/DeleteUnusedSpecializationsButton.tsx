"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteUnusedSpecializationsAction } from "../actions";

export function DeleteUnusedSpecializationsButton({ yearId }: { yearId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        "למחוק התמחויות בלי תלמידות ובלי שיעורים? שיעורים קיימים לא יימחקו."
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await deleteUnusedSpecializationsAction(yearId);
      if (result?.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.deleted
          ? `נמחקו ${result.deleted} התמחויות שלא בשימוש`
          : "אין התמחויות למחיקה"
      );
      await router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "המחיקה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="outline" onClick={() => void handleClick()} disabled={loading}>
        {loading ? "מוחק..." : "מחיקת התמחויות ללא תלמידות ושיעורים"}
      </Button>
      {message && <p className="text-caption text-on-surface-variant">{message}</p>}
    </div>
  );
}
