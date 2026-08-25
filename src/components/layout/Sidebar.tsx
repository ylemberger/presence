"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";

interface SidebarProps {
  activeYearName?: string;
  attendancePendingCount?: number;
  userEmail?: string | null;
}

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

export function Sidebar({
  activeYearName,
  attendancePendingCount = 0,
  userEmail,
}: SidebarProps) {
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
      className="print:hidden fixed right-0 top-0 z-50 flex h-full w-[17.5rem] flex-col bg-primary text-white shadow-tactile-sm"
      aria-label="ניווט ראשי"
    >
      <div className="flex flex-col gap-4 border-b border-white/15 px-5 py-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary font-headline-md text-headline-md text-primary"
            aria-hidden
          >
            נ
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md font-bold text-white">
              נוכחות סמינר
            </h1>
            <p className="font-caption text-caption text-white/80">
              ניהול נוכחות והיסטוריית שיבוצים
            </p>
          </div>
        </div>
        {activeYearName && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden />
            <span className="font-label-md text-label-md text-white">
              שנה {activeYearName}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 font-body-md text-body-md transition-colors",
                isActive
                  ? "bg-white font-semibold text-primary shadow-tactile-sm"
                  : isPending
                    ? "bg-white/15 text-white"
                    : "text-white hover:bg-white/10"
              )}
              aria-busy={isPending || undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  isActive ? "bg-secondary-container text-primary" : "bg-white/10 text-white"
                )}
                aria-hidden
              >
                <Icon name={iconName} className="text-[22px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/attendance" && attendancePendingCount > 0 && (
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                    isActive
                      ? "bg-secondary text-primary"
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

      <div className="border-t border-white/15 p-4">
        <div className="flex items-center gap-2">
          {userEmail && (
            <p
              className="min-w-0 flex-1 truncate text-right font-caption text-[11px] text-white/70"
              dir="ltr"
              title={userEmail}
            >
              {userEmail}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/25 px-3 py-2 font-label-md text-label-md text-white transition-colors hover:bg-white/10"
          >
            <Icon name="logout" className="text-[18px]" />
            התנתקות
          </button>
        </div>
      </div>
    </nav>
  );
}
