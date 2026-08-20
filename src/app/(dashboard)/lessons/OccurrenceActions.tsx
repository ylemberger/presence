"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cancelOccurrenceAction } from "../actions";

export function OccurrenceActions({ occurrenceId }: { occurrenceId: string }) {
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("לבטל מופע זה?")) return;
    await cancelOccurrenceAction(occurrenceId);
    router.refresh();
  }

  return (
    <Button variant="danger" size="sm" onClick={handleCancel}>
      ביטול
    </Button>
  );
}
