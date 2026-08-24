"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-lowest p-1.5 shadow-tactile-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
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
