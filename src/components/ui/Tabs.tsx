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
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-[var(--shadow-sm)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active === tab.id
                ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]"
                : "text-slate-600 hover:bg-[var(--surface-muted)] hover:text-slate-800"
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
