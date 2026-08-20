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
      <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active === tab.id
                ? "bg-[var(--brand)] text-white"
                : "text-slate-600 hover:bg-stone-100"
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
