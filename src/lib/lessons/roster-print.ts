import { formatHebrewDate, isDateInRange } from "@/lib/dates/hebrew";
import { compareStudentsByLastName } from "@/lib/students/sort";

export type RosterPrintStudent = {
  id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  assignmentNote: string | null;
};

export type LessonRosterPrintData = {
  id: string;
  subject: string;
  teacherName: string;
  groupLabel: string;
  students: RosterPrintStudent[];
};

type LinkRange = { start_date: string; end_date: string | null };

/** ממתי/עד מתי when the student does not cover every meeting date. */
export function assignmentNoteForLinks(
  links: LinkRange[],
  occDates: string[]
): string | null {
  if (links.length === 0) return null;
  const coversAll =
    occDates.length === 0 ||
    occDates.every((date) =>
      links.some((l) => isDateInRange(date, l.start_date, l.end_date))
    );
  if (coversAll) return null;

  const firstOcc = occDates[0] ?? "";
  const lastOcc = occDates[occDates.length - 1] ?? "";
  const starts = links.map((l) => l.start_date.slice(0, 10)).sort();
  const earliest = starts[0] ?? "";
  const open = links.some((l) => !l.end_date);
  const ends = links
    .map((l) => (l.end_date ? l.end_date.slice(0, 10) : null))
    .filter((d): d is string => Boolean(d))
    .sort();
  const latestEnd = open ? null : (ends[ends.length - 1] ?? null);
  const parts: string[] = [];
  if (earliest && (!firstOcc || earliest > firstOcc)) {
    parts.push(`מ־${formatHebrewDate(earliest)}`);
  }
  if (latestEnd && (!lastOcc || latestEnd < lastOcc)) {
    parts.push(`עד ${formatHebrewDate(latestEnd)}`);
  }
  if (parts.length === 0 && earliest) {
    parts.push(`מ־${formatHebrewDate(earliest)}`);
    if (latestEnd) parts.push(`עד ${formatHebrewDate(latestEnd)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildRosterStudents(
  byStudent: Map<
    string,
    {
      full_name: string;
      last_name?: string | null;
      first_name?: string | null;
      links: LinkRange[];
    }
  >,
  occDates: string[]
): RosterPrintStudent[] {
  return [...byStudent.entries()]
    .map(([id, row]) => ({
      id,
      full_name: row.full_name,
      last_name: row.last_name,
      first_name: row.first_name,
      assignmentNote: assignmentNoteForLinks(row.links, occDates),
    }))
    .sort(compareStudentsByLastName);
}
