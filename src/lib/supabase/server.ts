import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAllowedLoginEmail } from "@/lib/auth/allowed-emails";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}

/** For Server Actions — requires an allowed, authenticated user. */
export async function createActionClient(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; error?: never } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedLoginEmail(user.email)) {
    return { error: "אין הרשאה. התחברי מחדש." };
  }

  return { supabase };
}
