let cachedAllowedEmails: Set<string> | null = null;
let cachedViewerEmails: Set<string> | null = null;

/** View-only: teachers list and students list. No student card, no writes. */
const BUILTIN_VIEWER_EMAILS = [
  "sara.m@bybs.org.il",
  "shaindi.s@bybs.org.il",
  "h.babad@bybs.org.il",
  "machshev@bybs.org.il",
];

function parseEmailList(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAllowedLoginEmails(): Set<string> {
  if (cachedAllowedEmails) return cachedAllowedEmails;
  cachedAllowedEmails = new Set(parseEmailList(process.env.ALLOWED_LOGIN_EMAILS ?? ""));
  return cachedAllowedEmails;
}

function getViewerEmails(): Set<string> {
  if (cachedViewerEmails) return cachedViewerEmails;
  cachedViewerEmails = new Set([
    ...BUILTIN_VIEWER_EMAILS,
    ...parseEmailList(process.env.VIEWER_LOGIN_EMAILS ?? ""),
  ]);
  return cachedViewerEmails;
}

export function isViewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getViewerEmails().has(email.trim().toLowerCase());
}

/** Full editors from ALLOWED_LOGIN_EMAILS, plus view-only accounts. */
export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (getViewerEmails().has(normalized)) return true;
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0) return false;
  return allowed.has(normalized);
}

/** Pages a view-only account may open. Student and teacher cards are excluded. */
export function viewerMayOpenPath(pathname: string): boolean {
  return pathname === "/students" || pathname === "/teachers";
}
