type NamedPerson = {
  last_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  name?: string | null;
};

/** Second word of a full name. For a teacher that word is the family name. */
export function familyNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return parts[0] ?? "";
}

function storedName(person: NamedPerson): string {
  return (person.full_name ?? person.name ?? "").trim();
}

/** Sort people by family name, then given name. Students use last_name when it is stored. */
export function compareByFamilyName(a: NamedPerson, b: NamedPerson): number {
  const byLast = lastNameOf(a).localeCompare(lastNameOf(b), "he");
  if (byLast !== 0) return byLast;
  return firstNameOf(a).localeCompare(firstNameOf(b), "he");
}

/** Sort students by last name, then first name (Hebrew). */
export function compareStudentsByLastName(
  a: { last_name?: string | null; first_name?: string | null; full_name: string },
  b: { last_name?: string | null; first_name?: string | null; full_name: string }
): number {
  return compareByFamilyName(a, b);
}

export function familySortKey(person: NamedPerson): string {
  return `${lastNameOf(person)} ${firstNameOf(person)}`.trim();
}

function lastNameOf(person: NamedPerson): string {
  const explicit = (person.last_name ?? "").trim();
  if (explicit) return explicit;
  return familyNameFromFullName(storedName(person));
}

function firstNameOf(person: NamedPerson): string {
  const explicit = (person.first_name ?? "").trim();
  if (explicit) return explicit;
  const parts = storedName(person).split(/\s+/).filter(Boolean);
  return parts[0] ?? "";
}
