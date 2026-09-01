let cachedAllowedEmails: Set<string> | null = null;

function getAllowedLoginEmails(): Set<string> {
  if (cachedAllowedEmails) return cachedAllowedEmails;

  const raw = process.env.ALLOWED_LOGIN_EMAILS ?? "";
  cachedAllowedEmails = new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

  return cachedAllowedEmails;
}

export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0) return false;
  return allowed.has(email.trim().toLowerCase());
}
