export const ABSENCE_REASONS = [
  { value: "illness", label: "מחלה" },
  { value: "permission", label: "רשות" },
  { value: "family", label: "משפחתי" },
  { value: "unexcused", label: "לא מוצדק" },
] as const;

export type AbsenceReason = (typeof ABSENCE_REASONS)[number]["value"];

export function isAbsenceReason(value: string | null | undefined): value is AbsenceReason {
  return ABSENCE_REASONS.some((r) => r.value === value);
}
