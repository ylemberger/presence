"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useNavPending } from "@/lib/ui/nav-pending";

/** Thin top bar + chip while moving between dashboard pages (soft-nav feel). */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navPending = useNavPending();
  const [linkPending, setLinkPending] = useState(false);
  const active = navPending || linkPending;

  useEffect(() => {
    setLinkPending(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const next = `${url.pathname}${url.search}`;
        const current = `${window.location.pathname}${window.location.search}`;
        if (next !== current) setLinkPending(true);
      } catch {
        /* ignore invalid href */
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] print:hidden" aria-live="polite">
      <div className="h-0.5 overflow-hidden" aria-hidden>
        <div className="h-full w-full origin-right animate-[navProgress_1.1s_ease-in-out_infinite] bg-[var(--accent)]" />
      </div>
      <div className="flex justify-center pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-label-md text-label-md text-white shadow-tactile-md">
          <Icon name="sync" className="animate-spin text-[16px]" />
          בודקת נתונים…
        </span>
      </div>
    </div>
  );
}
