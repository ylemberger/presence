"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetLessonAttendanceAction } from "../actions";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

const CONFIRM =
  "יימחקו כל סימוני הנוכחות של השיעור, בכל המפגשים. המפגשים והתלמידות נשארים, והשיעור ייראה כאילו עוד לא מילאו נוכחות. להמשיך?";

export function ResetLessonAttendanceButton({
  lessonId,
  className,
}: {
  lessonId: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    if (!window.confirm(CONFIRM)) return;
    setPending(true);
    setError(null);
    try {
      const result = await resetLessonAttendanceAction(lessonId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("לא ניתן לאפס את הנוכחות");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-semibold text-caption text-primary hover:bg-surface-container-low disabled:opacity-60"
      >
        <Icon name="restart_alt" className="text-[16px]" />
        {pending ? "מאפסת…" : "אפסי נוכחות של כל המפגשים"}
      </button>
      {error ? (
        <p className="font-caption text-caption text-error">{error}</p>
      ) : null}
    </div>
  );
}
