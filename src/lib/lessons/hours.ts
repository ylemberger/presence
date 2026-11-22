import { BILLING_TYPE_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";

/** Highest numbered morning/noon period. Consecutive spans stay inside 1–this. */
export const MAX_NUMBERED_LESSON = 13;

/** First afternoon hour. Stored as the template start; extra hours are 15, 16, … */
export const AFTERNOON_LESSON_NUMBER = 14;

/** How many separate afternoon attendance meetings one lesson may open. */
export const MAX_AFTERNOON_PERIODS = 6;

export const AFTERNOON_LESSON_LABEL = "אחרי צהריים";

/** Highest stored lesson_number (afternoon start + extra afternoon hours). */
export const MAX_LESSON_NUMBER = AFTERNOON_LESSON_NUMBER + MAX_AFTERNOON_PERIODS - 1;

export function isAfternoonLesson(lessonNumber: number | null | undefined): boolean {
  if (lessonNumber == null || !Number.isFinite(lessonNumber)) return false;
  return lessonNumber >= AFTERNOON_LESSON_NUMBER && lessonNumber <= MAX_LESSON_NUMBER;
}

/** Template start for afternoon is always 14 — not 15/16 as a start hour. */
export function isAfternoonStart(lessonNumber: number | null | undefined): boolean {
  return lessonNumber === AFTERNOON_LESSON_NUMBER;
}

export function formatAfternoonHourLabel(lessonNumber: number): string {
  if (lessonNumber === AFTERNOON_LESSON_NUMBER) return AFTERNOON_LESSON_LABEL;
  const index = lessonNumber - AFTERNOON_LESSON_NUMBER + 1;
  return `${AFTERNOON_LESSON_LABEL} ${index}`;
}

export function occupiedLessonNumbers(start: number, count = 1): number[] {
  const n = Math.max(1, count);
  if (isAfternoonStart(start) || isAfternoonLesson(start)) {
    const from = isAfternoonStart(start) ? AFTERNOON_LESSON_NUMBER : start;
    return Array.from({ length: n }, (_, i) => from + i);
  }
  return Array.from({ length: n }, (_, i) => start + i);
}

export function formatLessonHours(start: number, count = 1): string {
  if (!start) return "";
  if (isAfternoonStart(start)) {
    if (count <= 1) return AFTERNOON_LESSON_LABEL;
    return `${AFTERNOON_LESSON_LABEL} · ${count} שעות`;
  }
  if (isAfternoonLesson(start)) {
    if (count <= 1) return formatAfternoonHourLabel(start);
    return `${formatAfternoonHourLabel(start)}–${formatAfternoonHourLabel(start + count - 1)}`;
  }
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
  const aHours = occupiedLessonNumbers(aStart, aCount);
  const bHours = occupiedLessonNumbers(bStart, bCount);
  const bSet = new Set(bHours);
  return aHours.some((h) => bSet.has(h));
}
