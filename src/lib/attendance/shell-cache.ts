/**
 * Short-lived read cache for attendance shell data (lessons, catalog, names).
 * Never store attendance marks or occurrence fill-state here, except the
 * pending-banner summary (separate key, busted after every attendance write).
 */

type Entry<T> = { at: number; value: T };

const TTL_MS = 90_000;
const store = new Map<string, Entry<unknown>>();

export function readShellCache<T>(key: string, ttlMs = TTL_MS): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function writeShellCache<T>(key: string, value: T): T {
  store.set(key, { at: Date.now(), value });
  return value;
}

function deleteKeysWithPrefix(prefix: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Call after catalog / lesson / student / teacher / settings writes — not after a single attendance mark. */
export function bustAttendanceShellCache() {
  store.clear();
}

/** Call after attendance writes so the sidebar badge is not stale. */
export function bustPendingAttendanceCache() {
  deleteKeysWithPrefix("pending:");
  deleteKeysWithPrefix("prev-week:");
}
