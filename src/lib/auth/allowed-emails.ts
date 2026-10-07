let cachedAllowedEmails: Set<string> | null = null;
let cachedViewerEmails: Set<string> | null = null;
let cachedReadAllEmails: Set<string> | null = null;

/** List-only: students and teachers lists. No student card, no writes. */
const BUILTIN_VIEWER_EMAILS = [
  "sara.m@bybs.org.il",
  "shaindi.s@bybs.org.il",
  "h.babad@bybs.org.il",
  "machshev@bybs.org.il",
];

/** All pages, including student cards. No writes. Wins over ALLOWED_LOGIN_EMAILS. */
const BUILTIN_READ_ALL_EMAILS = ["zipora.e@bybs.org.il", "sby7935@gmail.com"];

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

function getReadAllEmails(): Set<string> {
  if (cachedReadAllEmails) return cachedReadAllEmails;
  cachedReadAllEmails = new Set([
    ...BUILTIN_READ_ALL_EMAILS,
    ...parseEmailList(process.env.READ_ALL_LOGIN_EMAILS ?? ""),
  ]);
  return cachedReadAllEmails;
}

export function isViewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getViewerEmails().has(email.trim().toLowerCase());
}

export function isReadOnlyAllEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getReadAllEmails().has(email.trim().toLowerCase());
}

/** Cannot create, edit, sync, or change the active year. */
export function cannotWriteEmail(email: string | null | undefined): boolean {
  return isViewerEmail(email) || isReadOnlyAllEmail(email);
}

/** Full editors from ALLOWED_LOGIN_EMAILS, plus view-only accounts. */
export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (getViewerEmails().has(normalized) || getReadAllEmails().has(normalized)) return true;
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0) return false;
  return allowed.has(normalized);
}

/** Pages a view-only account may open. Student cards stay closed. A teacher card is allowed. */
export function viewerMayOpenPath(pathname: string): boolean {
  if (pathname === "/students" || pathname === "/teachers") return true;
  return /^\/teachers\/[^/]+$/.test(pathname);
}
