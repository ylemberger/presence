import { SeminarPrintHeader } from "@/components/print/SeminarPrintHeader";

export type LessonPrintStudent = {
  id: string;
  full_name: string;
  /** Partial assignment note, e.g. "מ־… · עד …". Null when she covers all meetings. */
  assignmentNote: string | null;
};

export function AttendanceLessonRosterPrint({
  subject,
  teacherName,
  groupLabel,
  students,
  printActive = true,
}: {
  subject: string;
  teacherName?: string;
  groupLabel?: string;
  students: LessonPrintStudent[];
  /** When false, stays screen-hidden and does not print (another sheet is active). */
  printActive?: boolean;
}) {
  const subtitle = [
    teacherName ? `מורה: ${teacherName}` : "",
    groupLabel ? `שיבוץ: ${groupLabel}` : "",
    `סה״כ ${students.length} תלמידות`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={printActive ? "hidden print:block" : "hidden"}>
      <SeminarPrintHeader title={subject} subtitle={subtitle} />
      <table className="w-full border-collapse text-right">
        <thead>
          <tr className="border-b-2 border-primary">
            <th className="w-10 px-2 py-2 font-label-md text-label-md">#</th>
            <th className="px-2 py-2 font-label-md text-label-md">שם</th>
            <th className="px-2 py-2 font-label-md text-label-md">שיוך לשיעור</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id} className="border-b border-outline-variant">
              <td className="px-2 py-2.5 font-body-md text-body-md text-on-surface-variant">
                {i + 1}
              </td>
              <td className="px-2 py-2.5 font-body-md text-body-md">{s.full_name}</td>
              <td className="px-2 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
                {s.assignmentNote
                  ? s.assignmentNote
                  : "משויכת לכל המופעים"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {students.some((s) => s.assignmentNote) ? (
        <p className="mt-3 text-[11px] text-on-surface-variant">
          «מ־» / «עד» — תלמידה שלא משויכת לכל מופעי השיעור; מופיעה רק במופעים שבטווח השיוך.
        </p>
      ) : null}
    </section>
  );
}
