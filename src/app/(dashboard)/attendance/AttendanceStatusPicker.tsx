"use client";

import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/types/database";
import { Icon } from "@/components/ui/Icon";

const STATUS_ORDER: AttendanceStatus[] = ["present", "late", "absent"];

const ICONS: Record<AttendanceStatus, string> = {
  present: "check",
  late: "schedule",
  absent: "close",
};

const SELECTED: Record<AttendanceStatus, string> = {
  present:
    "bg-attendance-present text-white border-attendance-present shadow-tactile-md",
  late: "bg-attendance-late text-primary border-attendance-late shadow-tactile-md",
  absent: "bg-attendance-absent text-white border-attendance-absent shadow-tactile-md",
};

const IDLE: Record<AttendanceStatus, string> = {
  present:
    "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-attendance-present hover:bg-attendance-present/10 hover:text-attendance-present",
  late: "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-attendance-late hover:bg-attendance-late/10 hover:text-attendance-late",
  absent:
    "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-attendance-absent hover:bg-attendance-absent/10 hover:text-attendance-absent",
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
        "inline-flex w-full min-w-[11rem] max-w-md items-center justify-center gap-2",
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
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border font-label-md text-label-md transition-all duration-150 active:scale-95",
              "min-h-[44px] touch-manipulation",
              compact ? "px-2 py-2" : "px-3 py-2.5",
              selected ? SELECTED[option] : IDLE[option],
              isSaving && "animate-pulse opacity-90",
              isSaved && "ring-2 ring-white ring-offset-1 ring-offset-surface",
              isError && "ring-2 ring-error ring-offset-1"
            )}
            aria-pressed={selected}
            aria-busy={isSaving}
          >
            <Icon
              name={ICONS[option]}
              className={cn(compact ? "text-[18px]" : "text-[20px]")}
            />
            <span>{ATTENDANCE_STATUS_LABELS[option]}</span>
            {isSaving && (
              <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white animate-ping" />
            )}
            {isSaved && (
              <span
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-caption font-normal opacity-90"
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
