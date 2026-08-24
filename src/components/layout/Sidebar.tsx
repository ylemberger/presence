"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  activeYearName?: string;
  attendancePendingCount?: number;
}

/** Map internal icon name → Material Symbols Outlined ligature */
const ICON_MAP: Record<string, string> = {
  home: "dashboard",
  students: "group",
  attendance: "fact_check",
  makeup: "edit_note",
  timetable: "calendar_month",
  lessons: "menu_book",
  teachers: "person_4",
  reports: "assessment",
  settings: "settings",
};

export function Sidebar({ activeYearName, attendancePendingCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav
      className="print:hidden fixed right-0 top-0 z-50 flex h-full w-[17.5rem] flex-col border-l border-outline-variant bg-primary-container shadow-tactile-sm"
      aria-label="ניווט ראשי"
    >
      {/* Brand Header */}
      <div className="flex flex-col gap-2 border-b border-white/10 p-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded bg-secondary text-xl font-bold text-on-secondary"
            aria-hidden
          >
            ס
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-secondary-container">
              סמינר
            </h1>
            <p className="text-caption text-on-primary-container">ניהול פנימי</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isPending = pendingHref === item.href;
          const iconName = ICON_MAP[item.icon] ?? "circle";
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => {
                if (!isActive) setPendingHref(item.href);
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-label-md transition-all duration-200",
                isActive
                  ? "-translate-x-[2px] border-r-4 border-secondary bg-primary text-on-primary"
                  : isPending
                    ? "bg-primary/40 text-white"
                    : "text-on-primary-container/80 hover:bg-primary/50 hover:text-white"
              )}
              aria-busy={isPending || undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                aria-hidden
              >
                {iconName}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/attendance" && attendancePendingCount > 0 && (
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                    isActive
                      ? "bg-secondary-container text-primary"
                      : "bg-secondary text-primary"
                  )}
                  title={`${attendancePendingCount} שיעורים ממתינים לרישום`}
                >
                  {attendancePendingCount > 9 ? "9+" : attendancePendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer Tabs & CTA */}
      <div className="mt-auto flex flex-col gap-2 border-t border-white/10 p-4">
        {activeYearName && (
          <div className="flex items-center gap-3 rounded-md px-4 py-2 text-label-md text-on-primary-container/80">
            <span className="material-symbols-outlined" aria-hidden>
              calendar_today
            </span>
            <span>{activeYearName}</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 w-full rounded-md border border-error/30 py-2 text-center text-label-md text-error-container transition-colors hover:bg-error/10"
        >
          התנתקות
        </button>
      </div>
    </nav>
  );
}
