import { isDateInRange } from "@/lib/dates/hebrew";
import { embedOne } from "@/lib/supabase/embed";

export type LessonLinkForRoster = {
  student_id: string;
  start_date: string;
  end_date: string | null;
  students?: unknown;
};

/** Unique active students whose assignment covers this date. Duplicate links count once. */
export function uniqueCoveredStudentIds(
  links: LessonLinkForRoster[],
  date: string
): string[] {
  const ids = new Set<string>();
  for (const link of links) {
    if (!link.student_id) continue;
    if (!isDateInRange(date, link.start_date, link.end_date)) continue;
    const student = embedOne<{ is_active?: boolean }>(link.students);
    if (student?.is_active === false) continue;
    ids.add(link.student_id);
  }
  return [...ids];
}
