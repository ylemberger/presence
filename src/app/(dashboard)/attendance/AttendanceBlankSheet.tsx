import { formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";
import { SeminarPrintHeader } from "@/components/print/SeminarPrintHeader";

export function AttendanceBlankSheet({
  subject,
  teacherName,
  groupLabel,
  date,
  students,
}: {
  subject: string;
  teacherName?: string;
  groupLabel?: string;
  date: string;
  students: { id: string; full_name: string }[];
}) {
  return (
    <section className="hidden print:block">
      <SeminarPrintHeader
        title={subject}
        subtitle={[
          formatHebrewDate(date),
          formatGregorianDate(date),
          teacherName ? `המורה ${teacherName}` : "",
          groupLabel || "",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <table className="w-full border-collapse text-right">
        <thead>
          <tr className="border-b-2 border-primary">
            <th className="px-2 py-2 font-label-md text-label-md">שם</th>
            <th className="w-24 px-2 py-2 text-center font-label-md text-label-md">נוכחת</th>
            <th className="w-24 px-2 py-2 text-center font-label-md text-label-md">איחור</th>
            <th className="w-24 px-2 py-2 text-center font-label-md text-label-md">נעדרה</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id} className="border-b border-outline-variant">
              <td className="px-2 py-2.5 font-body-md text-body-md">
                {i + 1}. {s.full_name}
              </td>
              <td className="px-2 py-2.5 text-center">
                <span className="inline-block h-5 w-5 rounded-sm border border-on-surface" />
              </td>
              <td className="px-2 py-2.5 text-center">
                <span className="inline-block h-5 w-5 rounded-sm border border-on-surface" />
              </td>
              <td className="px-2 py-2.5 text-center">
                <span className="inline-block h-5 w-5 rounded-sm border border-on-surface" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
