let cachedAllowedEmails: Set<string> | null = null;
let cachedViewerEmails: Set<string> | null = null;
let cachedReadAllEmails: Set<string> | null = null;

export type AccessRole = "editor" | "viewer" | "read_all";

/** List-only: students and teachers lists. No student card, no writes. */
const BUILTIN_VIEWER_EMAILS = [
  "sara.m@bybs.org.il",
  "shaindi.s@bybs.org.il",
  "h.babad@bybs.org.il",
  "machshev@bybs.org.il",
];

/** All pages, including student cards. No writes. */
const BUILTIN_READ_ALL_EMAILS = ["zipora.e@bybs.org.il", "sby7935@gmail.com"];

function parseEmailList(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function jwtEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
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

/** Used only if app_access_emails is missing (patch 028 not run yet). */
export function legacyAccessRole(email: string | null | undefined): AccessRole | null {
  const normalized = jwtEmail(email);
  if (!normalized) return null;
  if (getViewerEmails().has(normalized)) return "viewer";
  if (getReadAllEmails().has(normalized)) return "read_all";
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0) return null;
  if (allowed.has(normalized)) return "editor";
  return null;
}

function isMissingAccessTable(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return /app_access_emails|schema cache|PGRST205|42P01/i.test(
    `${error.message ?? ""} ${error.code ?? ""}`
  );
}

type AccessLookup = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => Promise<{
          data: { role?: string } | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
};

export async function fetchAccessRole(
  supabase: unknown,
  email: string | null | undefined
): Promise<AccessRole | null> {
  const normalized = jwtEmail(email);
  if (!normalized) return null;
  const client = supabase as AccessLookup;
  const { data, error } = await client
    .from("app_access_emails")
    .select("role")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    if (isMissingAccessTable(error)) return legacyAccessRole(normalized);
    return null;
  }
  if (data?.role === "editor" || data?.role === "viewer" || data?.role === "read_all") {
    return data.role;
  }
  return null;
}

export function isViewerEmail(email: string | null | undefined): boolean {
  return legacyAccessRole(email) === "viewer";
}

export function isReadOnlyAllEmail(email: string | null | undefined): boolean {
  return legacyAccessRole(email) === "read_all";
}

export function cannotWriteEmail(email: string | null | undefined): boolean {
  const role = legacyAccessRole(email);
  return role !== "editor";
}

export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  return legacyAccessRole(email) !== null;
}

export function viewerMayOpenPath(pathname: string): boolean {
  if (pathname === "/students" || pathname === "/teachers") return true;
  return /^\/teachers\/[^/]+$/.test(pathname);
}
