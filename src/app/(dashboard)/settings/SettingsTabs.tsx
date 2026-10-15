"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";

export function SettingsTabs({
  defaultTab,
  monthIso,
  tabs,
}: {
  defaultTab?: string;
  monthIso?: string;
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const router = useRouter();

  return (
    <Tabs
      variant="underline"
      defaultTab={defaultTab}
      onTabChange={(id) => {
        const params = new URLSearchParams();
        params.set("tab", id);
        if (monthIso) params.set("month", monthIso);
        router.replace(`/settings?${params.toString()}`, { scroll: false });
      }}
      tabs={tabs}
    />
  );
}
