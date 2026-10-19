/** Shown as empty. Satisfies the teachers phone/email checks when salary has no contact. */
const PLACEHOLDER_PHONE = "000000000";
const MIGRATION_PLACEHOLDER_PHONE = "0500000000";

function digits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export function storedPhone(raw: string | null | undefined): string {
  const d = digits(raw);
  if (d.length >= 9) return d;
  return PLACEHOLDER_PHONE;
}

export function storedEmail(raw: string | null | undefined, identity: string): string {
  const email = String(raw ?? "").trim();
  if (/^[^@]+@[^@]+\.[^@]+$/i.test(email)) return email;
  const local = identity.replace(/[^A-Za-z0-9._-]/g, "") || "teacher";
  let hash = 0;
  for (const ch of identity) hash = (hash * 33 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return `${local}.${hash.toString(16)}@local.invalid`;
}

/** A real identity number. Shared placeholders and salary keys are hidden. */
export function displayIdentityNumber(value: string | null | undefined): string | null {
  const digitsOnly = digits(value);
  if (digitsOnly.length < 8 || digitsOnly.length > 9) return null;
  const normalized = digitsOnly.padStart(9, "0").slice(-9);
  if (/^(\d)\1{8}$/.test(normalized)) return null;
  if (!/^\d+$/.test(String(value ?? "").trim())) return null;
  return normalized;
}

export function displayTeacherPhone(phone: string | null | undefined): string | null {
  const d = digits(phone);
  if (!d || d === PLACEHOLDER_PHONE || d === MIGRATION_PLACEHOLDER_PHONE) return null;
  return String(phone).trim() || null;
}

export function displayTeacherEmail(email: string | null | undefined): string | null {
  const value = String(email ?? "").trim();
  if (!value || value.toLowerCase().endsWith("@local.invalid")) return null;
  return value;
}
