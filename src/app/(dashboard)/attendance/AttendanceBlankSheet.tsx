import { formatGregorianDate, formatHebrewDate } from "@/lib/dates/hebrew";

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
      <header className="mb-6 border-b-[3px] border-primary pb-3">
        <p className="text-caption font-semibold text-secondary">דף נוכחות ריק</p>
        <h1 className="mt-1 font-headline-md text-headline-md text-primary">{subject}</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface">
          {formatHebrewDate(date)}
          <span className="mx-1 text-outline">·</span>
          {formatGregorianDate(date)}
          {teacherName ? ` · המורה ${teacherName}` : ""}
          {groupLabel ? ` · ${groupLabel}` : ""}
        </p>
      </header>
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
