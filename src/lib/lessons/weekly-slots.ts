import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatLessonHours, MAX_LESSON_NUMBER } from "@/lib/lessons/hours";

export type WeeklySlot = {
  dayOfWeek: number;
  lessonNumber: number;
  periodCount: number;
};

export type WeeklySlotRow = {
  day_of_week: number;
  lesson_number: number;
  period_count: number;
};

/** Normalize DB/form slots; keep one meeting per weekday (occurrence uniqueness is per date). */
export function normalizeWeeklySlots(
  slots: WeeklySlot[]
): WeeklySlot[] | { error: string } {
  if (slots.length === 0) {
    return { error: "יש לבחור לפחות מפגש אחד בשבוע" };
  }

  const cleaned: WeeklySlot[] = [];
  const daysSeen = new Set<number>();

  for (const slot of slots) {
    const dayOfWeek = Number(slot.dayOfWeek);
    const lessonNumber = Number(slot.lessonNumber);
    const periodCount = Number(slot.periodCount || 1);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { error: "יום בשבוע לא תקין באחד המפגשים" };
    }
    if (
      !Number.isInteger(lessonNumber) ||
      lessonNumber < 1 ||
      lessonNumber > MAX_LESSON_NUMBER
    ) {
      return { error: `שעת התחלה חייבת להיות בין 1 ל-${MAX_LESSON_NUMBER}` };
    }
    if (
      !Number.isInteger(periodCount) ||
      periodCount < 1 ||
      periodCount > MAX_LESSON_NUMBER
    ) {
      return { error: `מספר השעות הרצופות חייב להיות בין 1 ל-${MAX_LESSON_NUMBER}` };
    }
    if (lessonNumber + periodCount - 1 > MAX_LESSON_NUMBER) {
      return {
        error: `השעות הרצופות חורגות משיעור ${MAX_LESSON_NUMBER}. בחרי התחלה מוקדמת יותר או משך קצר יותר.`,
      };
    }
    if (daysSeen.has(dayOfWeek)) {
      return {
        error:
          "לא ניתן שני מפגשים באותו יום בשבוע לאותו שיעור. לשתי שעות באותו יום — הגדילי «מספר שעות רצופות».",
      };
    }
    daysSeen.add(dayOfWeek);
    cleaned.push({ dayOfWeek, lessonNumber, periodCount });
  }

  return cleaned.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.lessonNumber - b.lessonNumber
  );
}

export function parseWeeklySlotsFromFormData(
  formData: FormData
): WeeklySlot[] | { error: string } {
  const days = formData.getAll("slot_day_of_week").map(String);
  const starts = formData.getAll("slot_lesson_number").map(String);
  const counts = formData.getAll("slot_period_count").map(String);

  if (days.length > 0) {
    if (days.length !== starts.length || days.length !== counts.length) {
      return { error: "נתוני מפגשי השבוע לא שלמים" };
    }
    return normalizeWeeklySlots(
      days.map((day, i) => ({
        dayOfWeek: Number(day),
        lessonNumber: Number(starts[i]),
        periodCount: Number(counts[i] || 1),
      }))
    );
  }

  // Backward-compatible single fields (old clients / scripts).
  return normalizeWeeklySlots([
    {
      dayOfWeek: Number(formData.get("day_of_week")),
      lessonNumber: Number(formData.get("lesson_number")),
      periodCount: Number(formData.get("period_count") || 1),
    },
  ]);
}

export function slotsFromLessonAndRows(
  lesson: {
    day_of_week: number;
    lesson_number: number;
    period_count?: number | null;
  },
  rows: WeeklySlotRow[] | null | undefined
): WeeklySlot[] {
  if (rows && rows.length > 0) {
    const normalized = normalizeWeeklySlots(
      rows.map((r) => ({
        dayOfWeek: r.day_of_week,
        lessonNumber: r.lesson_number,
        periodCount: r.period_count ?? 1,
      }))
    );
    if (!("error" in normalized)) return normalized;
  }
  return [
    {
      dayOfWeek: lesson.day_of_week,
      lessonNumber: lesson.lesson_number,
      periodCount: lesson.period_count ?? 1,
    },
  ];
}

export function formatWeeklySlotsLabel(slots: WeeklySlot[]): string {
  if (slots.length === 0) return "";
  return slots
    .map((s) => {
      const day = DAY_OF_WEEK_LABELS[s.dayOfWeek] ?? "";
      const hours = formatLessonHours(s.lessonNumber, s.periodCount);
      return day ? `יום ${day} · ${hours}` : hours;
    })
    .filter(Boolean)
    .join(" · ");
}

export function primarySlot(slots: WeeklySlot[]): WeeklySlot {
  return slots[0];
}
