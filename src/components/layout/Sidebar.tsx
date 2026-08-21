"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  activeYearName?: string;
}

export function Sidebar({ activeYearName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="print:hidden flex w-[17.5rem] shrink-0 flex-col border-l border-white/10 bg-[var(--brand)] text-white">
      <div className="relative overflow-hidden px-5 pb-5 pt-6">
        <div
          className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/20 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--brand)] shadow-[var(--shadow-sm)]">
            <span className="text-lg font-black leading-none">נ</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">נוכחות סמינר</h1>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            ניהול נוכחות והיסטוריית שיבוצים
          </p>
          {activeYearName && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/90 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
              שנה {activeYearName}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-[var(--brand)] shadow-[var(--shadow-sm)]"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-[var(--accent-soft)] text-[var(--brand)]" : "bg-white/5 text-white/80"
                )}
              >
                <NavIcon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center rounded-xl bg-white/8 px-3 py-2.5 text-sm font-medium text-white/85 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
        >
          התנתקות
        </button>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "students":
      return (
        <svg {...common}>
          <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9.5" cy="7.5" r="2.5" />
          <path d="M20 19v-1a3.5 3.5 0 0 0-3-3.45" />
          <path d="M16 4.1a2.5 2.5 0 0 1 0 4.8" />
        </svg>
      );
    case "attendance":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case "lessons":
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "teachers":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
  }
}
