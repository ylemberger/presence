import { occupiedLessonNumbers } from "@/lib/lessons/hours";

export type AttendanceBlockInput = {
  id: string;
  date: string;
  subject: string;
  subjectId?: string;
  teacherName: string;
  teacherId: string;
  lessonId: string;
  lessonNumber: number;
  periodCount: number;
  groupLabel: string;
  audienceKey: string;
  studentCount: number;
  markedCount: number;
};

export type AttendanceBlock = AttendanceBlockInput & {
  linkedOccurrenceIds: string[];
  linkedLessonIds: string[];
};

function hourSpan(row: AttendanceBlockInput): { start: number; end: number } {
  const start = row.lessonNumber || 1;
  const count = Math.max(1, row.periodCount || 1);
  const hours = occupiedLessonNumbers(start, count);
  return { start: hours[0], end: hours[hours.length - 1] };
}

function canMerge(a: AttendanceBlockInput, b: AttendanceBlockInput): boolean {
  if (a.date !== b.date) return false;
  if (a.audienceKey !== b.audienceKey) return false;
  const as = hourSpan(a);
  const bs = hourSpan(b);
  return as.start <= bs.end + 1 && bs.start <= as.end + 1;
}

function collapse(rows: AttendanceBlockInput[]): AttendanceBlock {
  const sorted = [...rows].sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0));
  const first = sorted[0];
  const start = Math.min(...sorted.map((r) => hourSpan(r).start));
  const end = Math.max(...sorted.map((r) => hourSpan(r).end));
  return {
    ...first,
    lessonNumber: start,
    periodCount: end - start + 1,
    studentCount: Math.max(...sorted.map((r) => r.studentCount)),
    markedCount: Math.max(...sorted.map((r) => r.markedCount)),
    linkedOccurrenceIds: sorted.map((r) => r.id),
    linkedLessonIds: [...new Set(sorted.map((r) => r.lessonId))],
  };
}

/** Same-day consecutive hours of the same teacher + group + subject → one attendance block. */
export function mergeAttendanceBlocks(rows: AttendanceBlockInput[]): AttendanceBlock[] {
  const byKey = new Map<string, AttendanceBlockInput[]>();
  for (const row of rows) {
    const key = `${row.date}|${row.audienceKey}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const out: AttendanceBlock[] = [];
  for (const list of byKey.values()) {
    const sorted = [...list].sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0));
    let bucket: AttendanceBlockInput[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (canMerge(bucket[bucket.length - 1], next)) {
        bucket.push(next);
      } else {
        out.push(collapse(bucket));
        bucket = [next];
      }
    }
    if (bucket.length) out.push(collapse(bucket));
  }

  return out.sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0));
}
