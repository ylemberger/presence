export const FIXED_GRADE_NAMES = ["א", "ב", "ג"] as const;

export type FixedGradeName = (typeof FIXED_GRADE_NAMES)[number];

export function isFixedGradeName(name: string): name is FixedGradeName {
  return (FIXED_GRADE_NAMES as readonly string[]).includes(name);
}

export function filterFixedGrades<T extends { name: string }>(grades: T[]): T[] {
  return grades.filter((g) => isFixedGradeName(g.name));
}
