"use client";

import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/types/database";

const STATUS_ORDER: AttendanceStatus[] = ["present", "late", "absent"];

const CELL: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]",
  absent: "bg-rose-500 text-white border-rose-600 shadow-md scale-[1.02]",
  late: "bg-amber-400 text-slate-900 border-amber-500 shadow-md scale-[1.02]",
};

const IDLE: Record<AttendanceStatus, string> = {
  present: "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100",
  absent: "border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100",
  late: "border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100",
};

export type AttendancePickerPhase = "idle" | "saving" | "saved" | "error";

interface AttendanceStatusPickerProps {
  value: AttendanceStatus | null;
  phase?: AttendancePickerPhase;
  disabled?: boolean;
  onPick: (status: AttendanceStatus) => void;
  compact?: boolean;
}

export function AttendanceStatusPicker({
  value,
  phase = "idle",
  disabled,
  onPick,
  compact,
}: AttendanceStatusPickerProps) {
  return (
    <div
      className={cn(
        "inline-flex w-full min-w-[9.5rem] max-w-[12rem] gap-1 rounded-xl bg-stone-50/90 p-1",
        disabled && "pointer-events-none opacity-50"
      )}
      role="group"
      aria-label="סטטוס נוכחות"
    >
      {STATUS_ORDER.map((option) => {
        const selected = value === option;
        const isSaving = selected && phase === "saving";
        const isSaved = selected && phase === "saved";
        const isError = selected && phase === "error";

        return (
          <button
            key={option}
            type="button"
            disabled={disabled || isSaving}
            onClick={() => onPick(option)}
            className={cn(
              "relative flex-1 rounded-lg border font-bold transition-all duration-150 active:scale-95",
              compact ? "px-1 py-2 text-[10px]" : "px-1.5 py-2.5 text-xs",
              selected ? CELL[option] : IDLE[option],
              isSaving && "animate-pulse opacity-80",
              isSaved && "ring-2 ring-white ring-offset-1 ring-offset-stone-100",
              isError && "ring-2 ring-red-400 ring-offset-1"
            )}
            aria-pressed={selected}
            aria-busy={isSaving}
          >
            {ATTENDANCE_STATUS_LABELS[option]}
            {isSaving && (
              <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white animate-ping" />
            )}
            {isSaved && (
              <span
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-normal opacity-90"
                aria-hidden
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { STATUS_ORDER as ATTENDANCE_STATUS_ORDER };
