"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabsProps {
  tabs: { id: string; label: string; content: ReactNode }[];
  /**
   * Visual variant:
   * - "pill" (default): rounded pills inside a card container.
   * - "underline": Stitch-style flat tabs with an active bottom underline in secondary color.
   */
  variant?: "pill" | "underline";
  /** Restores the open tab after refresh when passed from the URL. */
  defaultTab?: string;
  onTabChange?: (id: string) => void;
}

export function Tabs({ tabs, variant = "pill", defaultTab, onTabChange }: TabsProps) {
  const initial =
    defaultTab && tabs.some((tab) => tab.id === defaultTab) ? defaultTab : tabs[0]?.id;
  const [active, setActive] = useState(initial);

  function select(id: string) {
    setActive(id);
    onTabChange?.(id);
  }

  if (variant === "underline") {
    return (
      <div>
        <div
          role="tablist"
          className="flex gap-stack_lg overflow-x-auto border-b border-outline-variant"
        >
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => select(tab.id)}
                className={cn(
                  "shrink-0 pb-3 px-1 font-label-md text-label-md transition-colors",
                  isActive
                    ? "border-b-2 border-secondary font-bold text-primary"
                    : "text-on-surface-variant hover:text-secondary"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="mt-stack_lg">{tabs.find((tab) => tab.id === active)?.content}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-lowest p-1.5 shadow-tactile-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => select(tab.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-label-md transition-colors",
              active === tab.id
                ? "bg-primary text-on-primary shadow-tactile-sm"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6">{tabs.find((tab) => tab.id === active)?.content}</div>
    </div>
  );
}
