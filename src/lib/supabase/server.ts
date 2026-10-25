import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAccessRole } from "@/lib/auth/allowed-emails";

export const createClient = cache(async () => {
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
});

/** Defense-in-depth for dashboard Server Components (middleware also guards). */
export const requireAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=unauthorized");
  }
  const accessRole = await fetchAccessRole(supabase, user.email);
  if (!accessRole) {
    redirect("/login?error=unauthorized");
  }

  return { supabase, user, accessRole };
});

/** For Server Actions — requires an allowed, authenticated user. */
export async function createActionClient(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; error?: never } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "אין הרשאה. התחברי מחדש." };
  }
  const accessRole = await fetchAccessRole(supabase, user.email);
  if (!accessRole) {
    return { error: "אין הרשאה. התחברי מחדש." };
  }

  if (accessRole !== "editor") {
    return { error: "לחשבון הזה יש הרשאת צפייה בלבד." };
  }

  return { supabase };
}
