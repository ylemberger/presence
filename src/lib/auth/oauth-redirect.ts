/** OAuth return URL after Google login. */
export function getOAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "/auth/callback";

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) {
    return `${window.location.protocol}//${window.location.host}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}

export function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Supabase ignores redirectTo when it is not in Redirect URLs, and falls
 * back to Site URL (often the Vercel production host). Force localhost
 * back into the authorize URL before the browser leaves the machine.
 */
export function forceLocalCallbackInOAuthUrl(authorizeUrl: string, callbackUrl: string): string {
  const stripped = authorizeUrl.replace(
    /https:\/\/[a-z0-9.-]+\.vercel\.app\/auth\/callback/gi,
    callbackUrl
  );
  try {
    const url = new URL(stripped);
    const keys = ["redirect_to", "redirectTo", "redirect_uri"] as const;
    for (const key of keys) {
      const current = url.searchParams.get(key);
      if (!current) continue;
      if (/vercel\.app/i.test(current) || !/localhost|127\.0\.0\.1/i.test(current)) {
        url.searchParams.set(key, callbackUrl);
      }
    }
    return url.toString();
  } catch {
    return stripped;
  }
}

export function oauthUrlPointsAtVercel(authorizeUrl: string): boolean {
  try {
    const url = new URL(authorizeUrl);
    const redirectTo =
      url.searchParams.get("redirect_to") ??
      url.searchParams.get("redirectTo") ??
      url.searchParams.get("redirect_uri") ??
      "";
    return /vercel\.app/i.test(redirectTo) || /vercel\.app/i.test(authorizeUrl);
  } catch {
    return /vercel\.app/i.test(authorizeUrl);
  }
}
