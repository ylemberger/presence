"use client";

import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

type Listener = () => void;

const listeners = new Set<Listener>();
let pendingCount = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeNavPending(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNavPending() {
  return pendingCount > 0;
}

export function useNavPending() {
  return useSyncExternalStore(subscribeNavPending, getNavPending, () => false);
}

export function usePendingRouter() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) return;
    pendingCount += 1;
    emit();
    return () => {
      pendingCount = Math.max(0, pendingCount - 1);
      emit();
    };
  }, [isPending]);

  const push = useCallback(
    (href: string, opts?: { scroll?: boolean }) => {
      startTransition(() => {
        router.push(href, opts);
      });
    },
    [router, startTransition]
  );

  const replace = useCallback(
    (href: string, opts?: { scroll?: boolean }) => {
      startTransition(() => {
        router.replace(href, opts);
      });
    },
    [router, startTransition]
  );

  return { isPending, push, replace, router, startTransition };
}
