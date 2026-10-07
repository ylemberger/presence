let cachedAllowedEmails: Set<string> | null = null;
let cachedRestrictedViewerEmails: Set<string> | null = null;
let cachedFullViewerEmails: Set<string> | null = null;

/** View students and teachers lists only. No student card, no writes. */
const BUILTIN_RESTRICTED_VIEWER_EMAILS = [
  "sara.m@bybs.org.il",
  "shaindi.s@bybs.org.il",
  "h.babad@bybs.org.il",
  "machshev@bybs.org.il",
  "ester.r@bybs.org.il",
];

/** View every page. No writes. */
const BUILTIN_FULL_VIEWER_EMAILS = ["zipora.e@bybs.org.il"];

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

function getRestrictedViewerEmails(): Set<string> {
  if (cachedRestrictedViewerEmails) return cachedRestrictedViewerEmails;
  cachedRestrictedViewerEmails = new Set([
    ...BUILTIN_RESTRICTED_VIEWER_EMAILS,
    ...parseEmailList(process.env.VIEWER_LOGIN_EMAILS ?? ""),
  ]);
  return cachedRestrictedViewerEmails;
}

function getFullViewerEmails(): Set<string> {
  if (cachedFullViewerEmails) return cachedFullViewerEmails;
  cachedFullViewerEmails = new Set([
    ...BUILTIN_FULL_VIEWER_EMAILS,
    ...parseEmailList(process.env.FULL_VIEWER_LOGIN_EMAILS ?? ""),
  ]);
  return cachedFullViewerEmails;
}

export function isRestrictedViewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getRestrictedViewerEmails().has(email.trim().toLowerCase());
}

export function isFullViewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getFullViewerEmails().has(email.trim().toLowerCase());
}

/** Any view-only account: cannot write. */
export function isViewerEmail(email: string | null | undefined): boolean {
  return isRestrictedViewerEmail(email) || isFullViewerEmail(email);
}

/** Full editors from ALLOWED_LOGIN_EMAILS, plus view-only accounts. */
export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (isViewerEmail(normalized)) return true;
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0) return false;
  return allowed.has(normalized);
}

/** Pages a list-only account may open. Student cards stay closed. A teacher card is allowed. */
export function viewerMayOpenPath(pathname: string): boolean {
  if (pathname === "/students" || pathname === "/teachers") return true;
  return /^\/teachers\/[^/]+$/.test(pathname);
}
