export const FLEXIBLE_RANGE_FORM_VALUE = "__flexible__";

export function isFlexibleActivityRange(
  range: { range_type?: string | null } | null | undefined
) {
  return range?.range_type === "flexible";
}
