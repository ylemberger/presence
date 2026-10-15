/** Sort students by last name, then first name (Hebrew). */

export function compareStudentsByLastName(
  a: { last_name?: string | null; first_name?: string | null; full_name: string },
  b: { last_name?: string | null; first_name?: string | null; full_name: string }
): number {
  const lastA = lastNameOf(a);
  const lastB = lastNameOf(b);
  const byLast = lastA.localeCompare(lastB, "he");
  if (byLast !== 0) return byLast;
  return firstNameOf(a).localeCompare(firstNameOf(b), "he");
}

function lastNameOf(s: {
  last_name?: string | null;
  first_name?: string | null;
  full_name: string;
}): string {
  const explicit = (s.last_name ?? "").trim();
  if (explicit) return explicit;
  const parts = s.full_name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : s.full_name.trim();
}

function firstNameOf(s: {
  last_name?: string | null;
  first_name?: string | null;
  full_name: string;
}): string {
  const explicit = (s.first_name ?? "").trim();
  if (explicit) return explicit;
  const parts = s.full_name.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? s.full_name.trim();
}
