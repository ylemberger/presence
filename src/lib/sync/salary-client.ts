import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_HOST = /^[a-z0-9-]+\.supabase\.co$/i;

const WRITE_METHODS = new Set([
  "insert",
  "update",
  "delete",
  "upsert",
  "rpc",
]);

type SalarySelectBuilder = {
  select: (columns: string) => SalarySelectBuilder;
  eq: (column: string, value: unknown) => SalarySelectBuilder;
  range: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

export type SalaryReadOnlyClient = {
  from: (table: string) => { select: SalarySelectBuilder["select"] };
};

export type SalaryReadClient =
  | { client: SalaryReadOnlyClient; error?: never }
  | { client?: never; error: string };

function blockWrite(method: string): never {
  throw new Error(`מערכת השכר לקריאה בלבד — אסור ${method}.`);
}

function wrapQuery(query: object): SalarySelectBuilder {
  return new Proxy(query as SalarySelectBuilder, {
    get(target, prop, receiver) {
      const name = String(prop);
      if (WRITE_METHODS.has(name)) {
        return () => blockWrite(name);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          if (result && typeof result === "object" && typeof (result as { then?: unknown }).then !== "function") {
            return wrapQuery(result);
          }
          return result;
        };
      }
      return value;
    },
  });
}

function wrapReadOnlyClient(raw: { from: (table: string) => object }): SalaryReadOnlyClient {
  return {
    from(table: string) {
      const builder = wrapQuery(raw.from(table));
      return {
        select(columns: string) {
          return builder.select(columns);
        },
      };
    },
  };
}

/**
 * Read-only client for the seminar salary system.
 * URL is from env (not user input). Only HTTPS + *.supabase.co.
 * Write methods throw at runtime even if called by mistake.
 */
export function createSalaryReadClient(): SalaryReadClient {
  const rawUrl = process.env.SALARY_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SALARY_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!rawUrl || !key) {
    return { error: "חסר חיבור למערכת השכר. יש להגדיר SALARY_SUPABASE_URL ו-SALARY_SUPABASE_ANON_KEY." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { error: "כתובת מערכת השכר אינה תקינה." };
  }

  if (parsed.protocol !== "https:") {
    return { error: "חיבור למערכת השכר חייב להיות HTTPS." };
  }
  if (!SUPABASE_HOST.test(parsed.hostname)) {
    return { error: "כתובת מערכת השכר אינה מותרת." };
  }

  const raw = createSupabaseClient(parsed.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client: wrapReadOnlyClient(raw) };
}
