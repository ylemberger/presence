"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

interface UserAvatarProps {
  name: string;
  email?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
  /** Light text variant for the dark sidebar */
  onDark?: boolean;
}

export function UserAvatar({
  name,
  email,
  imageUrl,
  size = "md",
  className,
  onDark = false,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const initial = (name || email || "?").trim().slice(0, 1).toUpperCase();
  const px = size === "sm" ? "h-8 w-8 text-caption" : "h-9 w-9 text-label-md";
  const showImage = Boolean(imageUrl) && !broken;
  const title = email ? `${name} · ${email}` : name;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        px,
        onDark ? "bg-white/20 text-white" : "bg-primary text-white",
        className
      )}
      title={title}
      aria-label={title}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL; avoid next/image host coupling
        <img
          src={imageUrl!}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : initial ? (
        initial
      ) : (
        <Icon name="account_circle" className="text-[22px]" />
      )}
    </span>
  );
}
