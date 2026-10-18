/** Unwrap a PostgREST embed that may be an object or a one-element array. */
export function embedOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return ((value[0] as T) ?? null);
  return value as T;
}

/** Student embed: skip only when is_active is explicitly false. */
export function embedActiveStudent<T extends { is_active?: boolean }>(value: unknown): T | null {
  const student = embedOne<T>(value);
  if (!student || student.is_active === false) return null;
  return student;
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
