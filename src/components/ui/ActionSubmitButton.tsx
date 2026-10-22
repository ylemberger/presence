"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function ActionSubmitButton({
  loading,
  saved,
  idleLabel,
  loadingLabel = "שומרת…",
  savedLabel = "נשמר",
  idleIcon,
  className,
  size,
  disabled,
}: {
  loading: boolean;
  saved: boolean;
  idleLabel: string;
  loadingLabel?: string;
  savedLabel?: string;
  idleIcon?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      size={size}
      className={className}
      disabled={disabled || loading}
      variant={saved && !loading ? "success" : "primary"}
      aria-live="polite"
    >
      {loading ? (
        <>
          <Icon name="sync" className="animate-spin text-[18px]" />
          {loadingLabel}
        </>
      ) : saved ? (
        <>
          <Icon name="check_circle" className="text-[18px]" />
          {savedLabel}
        </>
      ) : (
        <>
          {idleIcon ? <Icon name={idleIcon} className="text-[18px]" /> : null}
          {idleLabel}
        </>
      )}
    </Button>
  );
}
