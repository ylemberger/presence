import { BILLING_TYPE_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";

export function occupiedLessonNumbers(start: number, count = 1): number[] {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => start + i);
}

export function formatLessonHours(start: number, count = 1): string {
  if (!start) return "";
  if (count <= 1) return `שיעור ${start}`;
  return `שיעורים ${start}–${start + count - 1}`;
}

export function formatLessonOptionLabel(lesson: {
  subject: string;
  subjectName?: string | null;
  day_of_week?: number | null;
  lesson_number?: number | null;
  period_count?: number | null;
  billing_type?: string | null;
}): string {
  const parts = [formatSubjectLessonLabel(lesson.subjectName, lesson.subject)];
  if (lesson.day_of_week != null) {
    const day = DAY_OF_WEEK_LABELS[lesson.day_of_week];
    if (day) parts.push(`יום ${day}`);
  }
  if (lesson.lesson_number) {
    parts.push(formatLessonHours(lesson.lesson_number, lesson.period_count ?? 1));
  }
  if (lesson.billing_type && lesson.billing_type in BILLING_TYPE_LABELS) {
    parts.push(BILLING_TYPE_LABELS[lesson.billing_type as keyof typeof BILLING_TYPE_LABELS]);
  }
  return parts.join(" · ");
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
