import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedLoginEmail } from "@/lib/auth/allowed-emails";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const isLocalHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isVercelHost = url.hostname.endsWith(".vercel.app");
  const wantsLocal =
    searchParams.get("dev_local") === "1" ||
    searchParams.get("return_to") === "local";

  // Bounce unused OAuth codes back to localhost BEFORE exchanging them.
  if (isVercelHost && wantsLocal && code) {
    const bounce = new URL("http://localhost:3000/auth/callback");
    searchParams.forEach((value, key) => {
      if (key !== "dev_local" && key !== "return_to") {
        bounce.searchParams.set(key, value);
      }
    });
    return NextResponse.redirect(bounce.toString());
  }

  if (oauthError && !code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedLoginEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development" || isLocalHost;

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (forwardedHost && !forwardedHost.includes("localhost")) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
