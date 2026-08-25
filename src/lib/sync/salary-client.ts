import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_HOST = /^[a-z0-9-]+\.supabase\.co$/i;

export type SalaryReadClient =
  | { client: SupabaseClient; error?: never }
  | { client?: never; error: string };

/**
 * Read-only client for the seminar salary system.
 * URL is from env (not user input). Only HTTPS + *.supabase.co.
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

  return {
    client: createSupabaseClient(parsed.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
