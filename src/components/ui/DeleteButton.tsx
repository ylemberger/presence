"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DeleteButtonProps {
  onDelete: () => Promise<{ error?: string }>;
  label?: string;
}

export function DeleteButton({ onDelete, label = "מחק" }: DeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("האם את בטוחה שברצונך למחוק?")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onDelete();
      if (result?.error) {
        setError(result.error);
        return;
      }
      await router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "מחיקה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
        {loading ? "מוחק..." : label}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
