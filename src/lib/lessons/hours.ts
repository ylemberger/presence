export function occupiedLessonNumbers(start: number, count = 1): number[] {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => start + i);
}

export function formatLessonHours(start: number, count = 1): string {
  if (!start) return "";
  if (count <= 1) return `שיעור ${start}`;
  return `שיעורים ${start}–${start + count - 1}`;
}

export function lessonHoursOverlap(
  aStart: number,
  aCount: number,
  bStart: number,
  bCount: number
): boolean {
  const aEnd = aStart + Math.max(1, aCount) - 1;
  const bEnd = bStart + Math.max(1, bCount) - 1;
  return aStart <= bEnd && bStart <= aEnd;
}
