"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { UserAvatar } from "@/components/layout/UserAvatar";

interface SidebarProps {
  activeYearName?: string;
  attendancePendingCount?: number;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
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

const STORAGE_KEY = "presence-sidebar-collapsed";

function isCollapsedDom() {
  return document.documentElement.dataset.sidebar === "collapsed";
}

function applyCollapsed(collapsed: boolean) {
  if (collapsed) {
    document.documentElement.dataset.sidebar = "collapsed";
  } else {
    delete document.documentElement.dataset.sidebar;
  }
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function Sidebar({
  activeYearName,
  attendancePendingCount = 0,
  userEmail,
  userName,
  userAvatarUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    setCollapsed(isCollapsedDom());
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !isCollapsedDom();
    setCollapsed(next);
    applyCollapsed(next);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav
      className="print:hidden fixed right-0 top-0 z-50 flex h-full w-[var(--sidebar-width)] flex-col bg-primary text-white shadow-tactile-sm transition-[width] duration-200"
      aria-label="ניווט ראשי"
    >
      <div className="sidebar-header flex flex-col gap-4 border-b border-white/15 px-5 py-6">
        <div className="sidebar-header-row flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary font-headline-md text-headline-md text-primary"
            aria-hidden
            title={activeYearName ? `שנה ${activeYearName}` : "נוכחות סמינר"}
          >
            נ
          </div>
          <div className="sidebar-expanded-only min-w-0">
            <h1 className="whitespace-nowrap font-headline-md text-headline-md font-bold text-white">
              נוכחות סמינר
            </h1>
            <p className="font-caption text-caption text-white/80">
              ניהול נוכחות והיסטוריית שיבוצים
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="sidebar-toggle ms-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-expanded={!collapsed}
            aria-controls="sidebar-nav-items"
            aria-label={collapsed ? "פתחי את תפריט הניווט" : "סגרי את תפריט הניווט — סמלים בלבד"}
            title={collapsed ? "פתחי תפריט" : "סגרי תפריט"}
          >
            <Icon
              name="chevron_right"
              className="sidebar-expanded-only text-[22px]"
            />
            <Icon
              name="chevron_left"
              className="sidebar-collapsed-only text-[22px]"
            />
          </button>
        </div>
        {activeYearName && (
          <div className="sidebar-expanded-only inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden />
            <span className="font-label-md text-label-md text-white">
              שנה {activeYearName}
            </span>
          </div>
        )}
      </div>

      <div
        id="sidebar-nav-items"
        className="sidebar-nav flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
      >
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
              title={item.label}
              onClick={() => {
                if (!isActive) setPendingHref(item.href);
              }}
              className={cn(
                "sidebar-link relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-body-md text-body-md transition-colors",
                isActive
                  ? "bg-white font-semibold text-primary shadow-tactile-sm"
                  : isPending
                    ? "bg-white/15 text-white"
                    : "text-white hover:bg-white/10"
              )}
              aria-busy={isPending || undefined}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <span
                className={cn(
                  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  isActive ? "bg-secondary-container text-primary" : "bg-white/10 text-white"
                )}
                aria-hidden
              >
                <Icon name={iconName} className="text-[22px]" />
                {item.href === "/attendance" && attendancePendingCount > 0 && (
                  <span
                    className="sidebar-icon-badge absolute -top-1 inset-inline-start-[-0.2rem] min-w-[1rem] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-primary"
                    title={`${attendancePendingCount} שיעורים ממתינים לרישום`}
                  >
                    {attendancePendingCount > 9 ? "9+" : attendancePendingCount}
                  </span>
                )}
              </span>
              <span className="sidebar-expanded-only flex-1">{item.label}</span>
              {item.href === "/attendance" && attendancePendingCount > 0 && (
                <span
                  className="sidebar-expanded-only min-w-[1.25rem] rounded-full bg-secondary px-1.5 py-0.5 text-center text-[10px] font-bold text-primary"
                  title={`${attendancePendingCount} שיעורים ממתינים לרישום`}
                >
                  {attendancePendingCount > 9 ? "9+" : attendancePendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer border-t border-white/15 p-4">
        <div className="sidebar-footer-row flex items-center gap-2">
          {(userName || userEmail) && (
            <>
              <div className="sidebar-expanded-only flex min-w-0 flex-1 items-center gap-2">
                <UserAvatar
                  name={userName || userEmail || "?"}
                  email={userEmail}
                  imageUrl={userAvatarUrl}
                  size="sm"
                  onDark
                />
                <div className="min-w-0 text-right">
                  <p className="truncate font-label-md text-[12px] font-semibold text-white">
                    {userName || "משתמשת"}
                  </p>
                  {userEmail && (
                    <p
                      className="truncate font-caption text-[10px] text-white/55"
                      dir="ltr"
                      title={userEmail}
                    >
                      {userEmail}
                    </p>
                  )}
                </div>
              </div>
              <UserAvatar
                name={userName || userEmail || "?"}
                email={userEmail}
                imageUrl={userAvatarUrl}
                size="sm"
                onDark
                className="sidebar-collapsed-only"
              />
            </>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="התנתקות"
            aria-label="התנתקות"
            className="sidebar-logout flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/25 px-3 py-2 font-label-md text-label-md text-white transition-colors hover:bg-white/10"
          >
            <Icon name="logout" className="text-[18px]" />
            <span className="sidebar-expanded-only">התנתקות</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
