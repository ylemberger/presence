"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/auth/AccessProvider";
import { Button } from "@/components/ui/Button";

interface DeleteButtonProps {
  onDelete: () => Promise<{ error?: string }>;
  label?: string;
  confirmMessage?: string;
  redirectTo?: string;
}

export function DeleteButton({
  onDelete,
  label = "מחק",
  confirmMessage = "האם את בטוחה שברצונך למחוק?",
  redirectTo,
}: DeleteButtonProps) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canWrite) return null;

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onDelete();
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      await router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(/[\u0590-\u05FF]/.test(message) ? message : "הפעולה נכשלה");
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
