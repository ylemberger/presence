"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { generateOccurrencesAction } from "../actions";
import { Icon } from "@/components/ui/Icon";

export function GenerateOccurrencesButton({ academicYearId }: { academicYearId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateOccurrencesAction(academicYearId);
      if (result.error) setMessage(result.error);
      else if (result.result)
        setMessage(`נוצרו ${result.result.created} מופעים, דולגו ${result.result.skipped}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "יצירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={handleGenerate} disabled={loading}>
        <Icon name="event_repeat" className="text-[18px]" />
        {loading ? "יוצר..." : "יצירת מופעים"}
      </Button>
      {message && (
        <p className="mt-1 font-caption text-caption text-on-surface-variant">{message}</p>
      )}
    </div>
  );
}
