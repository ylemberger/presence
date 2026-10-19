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
  return `${local}@local.invalid`;
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
