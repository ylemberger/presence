"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { generateOccurrencesAction } from "../actions";

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
        {loading ? "יוצר..." : "יצירת מופעי שיעור"}
      </Button>
      {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
