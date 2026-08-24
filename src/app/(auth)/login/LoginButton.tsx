"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoginButtonProps = {
  loginHintEmail?: string | null;
};

export function LoginButton({ loginHintEmail }: LoginButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
        queryParams: {
          ...(loginHintEmail ? { login_hint: loginHintEmail } : {}),
          prompt: "select_account",
        },
      },
    });

    if (oauthError || !data.url) {
      setError(
        oauthError?.message ??
          "Google לא מופעל ב-Supabase. הדביקי Client ID ו-Secret ב-Authentication → Providers → Google."
      );
      setLoading(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="w-full space-y-3">
      {error && (
        <p
          className="rounded border border-error/20 bg-error-container px-3 py-2 text-caption text-on-error-container"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleLogin}
        className="flex w-full items-center justify-center gap-3 rounded bg-primary px-6 py-4 font-label-md text-label-md text-on-primary shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "מעבירה ל־Google..." : "התחברות עם Google"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="h-5 w-5 rounded-full bg-surface-container-lowest p-0.5"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
