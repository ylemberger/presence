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
      className="print:hidden fixed right-0 top-0 z-50 flex h-full w-[17.5rem] flex-col bg-primary shadow-tactile-sm"
      aria-label="ניווט ראשי"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-4 border-b border-white/10 p-stack_lg">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary font-headline-md text-headline-md text-on-secondary"
          aria-hidden
        >
          נ
        </div>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-secondary">נוכחות סמינר</h1>
          {activeYearName && (
            <p className="font-caption text-caption text-on-primary opacity-80">
              {activeYearName} - שנה פעילה
            </p>
          )}
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
                "mx-2 flex items-center gap-4 rounded-lg px-4 py-3 font-body-md text-body-md transition-colors",
                isActive
                  ? "border-r-4 border-secondary bg-primary-container text-secondary"
                  : isPending
                    ? "bg-primary-container/60 text-on-primary"
                    : "text-on-primary hover:bg-primary-container"
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
      <div className="mt-auto border-t border-white/10 p-stack_md">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-4 rounded-lg px-4 py-3 font-body-md text-body-md text-on-primary transition-colors hover:bg-primary-container"
        >
          <span className="material-symbols-outlined" aria-hidden>
            logout
          </span>
          התנתקות
        </button>
      </div>
    </nav>
  );
}
