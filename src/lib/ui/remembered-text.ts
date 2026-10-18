"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/** Keeps a search string on screen across refresh, without putting it in the address bar. */
export function useRememberedText(key: string) {
  const [value, setValue] = useState("");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) setValue(saved);
    } catch {
      /* session storage unavailable */
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch {
      /* ignore quota / private mode */
    }
  }, [key, ready, value]);

  return [value, setValue] as const;
}
