import { BILLING_TYPE_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";

/** Highest numbered period. Consecutive spans stay inside 1–this. */
export const MAX_NUMBERED_LESSON = 13;

/** Afternoon block. Stored as this lesson number so it always sorts last. */
export const AFTERNOON_LESSON_NUMBER = 14;

export const AFTERNOON_LESSON_LABEL = "אחרי צהריים";

/** Highest stored lesson_number, including the afternoon slot. */
export const MAX_LESSON_NUMBER = AFTERNOON_LESSON_NUMBER;

export function isAfternoonLesson(lessonNumber: number | null | undefined): boolean {
  return lessonNumber === AFTERNOON_LESSON_NUMBER;
}

export function occupiedLessonNumbers(start: number, count = 1): number[] {
  if (isAfternoonLesson(start)) return [AFTERNOON_LESSON_NUMBER];
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => start + i);
}

export function formatLessonHours(start: number, count = 1): string {
  if (!start) return "";
  if (isAfternoonLesson(start)) return AFTERNOON_LESSON_LABEL;
  if (count <= 1) return `שיעור ${start}`;
  return `שיעורים ${start}–${start + count - 1}`;
}

export function lessonHourSelectOptions(): { value: string; label: string }[] {
  return [
    ...Array.from({ length: MAX_NUMBERED_LESSON }, (_, i) => ({
      value: String(i + 1),
      label: `שיעור ${i + 1}`,
    })),
    { value: String(AFTERNOON_LESSON_NUMBER), label: AFTERNOON_LESSON_LABEL },
  ];
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
