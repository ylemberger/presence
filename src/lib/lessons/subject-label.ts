/** כותרת: מקצוע · שם שיעור. אם השמות זהים (אחרי מיגרציה) — פעם אחת. */
export function formatSubjectLessonLabel(
  subjectName: string | null | undefined,
  lessonName: string
): string {
  const parent = (subjectName ?? "").trim();
  const lesson = lessonName.trim();
  if (!lesson) return parent || "ללא שם";
  if (!parent || parent === lesson) return lesson;
  return `${parent} · ${lesson}`;
}
