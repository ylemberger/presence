/**
 * Short-lived read cache for attendance shell data (lessons, catalog, names).
 * Never store attendance marks or occurrence fill-state here.
 */

type Entry<T> = { at: number; value: T };

const TTL_MS = 45_000;
const store = new Map<string, Entry<unknown>>();

export function readShellCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function writeShellCache<T>(key: string, value: T): T {
  store.set(key, { at: Date.now(), value });
  return value;
}

/** Call after catalog / lesson / student / teacher / settings writes — not after a single attendance mark. */
export function bustAttendanceShellCache() {
  store.clear();
}
