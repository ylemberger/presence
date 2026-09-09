/** Unwrap a PostgREST embed that may be an object or a one-element array. */
export function embedOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return ((value[0] as T) ?? null);
  return value as T;
}

export function embeddedTeacher(
  teachingAssignment: unknown
): { id: string; fullName: string } | null {
  const assignment = embedOne<{
    teacher_id?: string | null;
    teachers?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }>(teachingAssignment);
  const teacherId = assignment?.teacher_id ?? "";
  const teacher = embedOne<{ full_name?: string | null }>(assignment?.teachers);
  const fullName = teacher?.full_name?.trim() ?? "";
  if (!teacherId && !fullName) return null;
  return { id: teacherId, fullName };
}
