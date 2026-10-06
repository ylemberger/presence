export type NamedTeacher = { id: string; full_name: string };

/** Same person may arrive once per salary subject. Group by the stored full name. */
export function teacherNameKey(fullName: string): string {
  return fullName.trim().replace(/\s+/g, " ").toLocaleLowerCase("he");
}

export function displayTeacherName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, " ");
}

/** One option per name. The id is a stable representative of that name group. */
export function uniqueTeachersByName(
  teachers: NamedTeacher[]
): { id: string; name: string }[] {
  const sorted = [...teachers].sort(
    (a, b) =>
      a.full_name.localeCompare(b.full_name, "he") || a.id.localeCompare(b.id)
  );
  const seen = new Set<string>();
  const options: { id: string; name: string }[] = [];
  for (const teacher of sorted) {
    const key = teacherNameKey(teacher.full_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push({ id: teacher.id, name: displayTeacherName(teacher.full_name) });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/** Every teacher row that shares the selected person's name, including the selected id. */
export function teacherIdsSharingName(
  teachers: NamedTeacher[],
  selectedId: string
): Set<string> {
  const selected = teachers.find((teacher) => teacher.id === selectedId);
  if (!selected) return new Set([selectedId]);
  const key = teacherNameKey(selected.full_name);
  if (!key) return new Set([selectedId]);
  const ids = teachers
    .filter((teacher) => teacherNameKey(teacher.full_name) === key)
    .map((teacher) => teacher.id);
  return new Set(ids.length > 0 ? ids : [selectedId]);
}

export function representativeTeacherId(
  teachers: NamedTeacher[],
  selectedId: string | undefined
): string | undefined {
  if (!selectedId) return undefined;
  const group = teacherIdsSharingName(teachers, selectedId);
  return uniqueTeachersByName(teachers).find((option) => group.has(option.id))?.id ?? selectedId;
}
