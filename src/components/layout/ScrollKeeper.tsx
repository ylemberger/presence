"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function storageKey() {
  return `presence-scroll:${window.location.pathname}${window.location.search}`;
}

function readScroll() {
  try {
    const y = Number(sessionStorage.getItem(storageKey()) || "0");
    return Number.isFinite(y) && y > 0 ? y : 0;
  } catch {
    return 0;
  }
}

function writeScroll(y = window.scrollY) {
  try {
    sessionStorage.setItem(storageKey(), String(y));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Keeps the window where the user left it: on refresh, and when a search
 * only changes the query string. A new page still starts at the top.
 */
export function ScrollKeeper() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const sawUrl = useRef(false);

  useEffect(() => {
    let saved = readScroll();
    let hold = saved > 0;
    const release = () => {
      hold = false;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);

    const restore = () => {
      if (!hold || saved <= 0) return;
      if (Math.abs(window.scrollY - saved) > 1) window.scrollTo(0, saved);
    };
    restore();
    let frames = 0;
    const timer = window.setInterval(() => {
      restore();
      frames += 1;
      if (frames >= 12 || !hold) window.clearInterval(timer);
    }, 50);

    const save = () => {
      if (hold && saved > 0 && window.scrollY === 0) return;
      writeScroll();
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);

    const onPop = () => {
      window.setTimeout(() => {
        saved = readScroll();
        if (saved > 0) window.scrollTo(0, saved);
      }, 0);
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!sawUrl.current) {
      sawUrl.current = true;
      return;
    }
    writeScroll();
  }, [pathname, search]);

  return null;
}
