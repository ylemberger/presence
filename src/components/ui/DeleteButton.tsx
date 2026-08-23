"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DeleteButtonProps {
  onDelete: () => Promise<{ error?: string }>;
  label?: string;
  /** Hide the row/container immediately after successful delete */
  optimistic?: boolean;
  onDeleted?: () => void;
}

export function DeleteButton({
  onDelete,
  label = "מחק",
  optimistic = false,
  onDeleted,
}: DeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "deleting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("האם את בטוחה שברצונך למחוק?")) return;
    setPhase("deleting");
    setError(null);
    try {
      const result = await onDelete();
      if (result?.error) {
        setError(result.error);
        setPhase("idle");
        return;
      }
      setPhase("done");
      if (optimistic) onDeleted?.();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "מחיקה נכשלה");
      setPhase("idle");
    }
  }

  const loading = phase === "deleting" || isPending;
  const labelText =
    phase === "deleting" ? "מוחק..." : phase === "done" ? "נמחק ✓" : label;

  return (
    <div>
      <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
        {labelText}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
