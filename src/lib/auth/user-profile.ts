import type { User } from "@supabase/supabase-js";

export type AuthUserProfile = {
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Display fields from Google / Supabase Auth — no business logic. */
export function authUserProfile(user: User): AuthUserProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const identities = user.identities ?? [];
  const googleIdentity = identities.find((item) => item.provider === "google");
  const googleData = (googleIdentity?.identity_data ?? {}) as Record<string, unknown>;

  const avatarUrl = firstString(
    meta.avatar_url,
    meta.picture,
    googleData.avatar_url,
    googleData.picture
  );
  const displayName =
    firstString(meta.full_name, meta.name, googleData.full_name, googleData.name) ??
    (user.email ? user.email.split("@")[0] : "משתמשת");

  return {
    email: user.email ?? null,
    displayName,
    avatarUrl,
  };
}
