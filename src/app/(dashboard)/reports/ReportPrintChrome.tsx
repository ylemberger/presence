interface FilterItem {
  label: string;
  value: string;
}

interface ReportPrintHeaderProps {
  title: string;
  yearName: string;
  printedHebrew: string;
  printedGregorian: string;
  filters: FilterItem[];
}

export function ReportPrintHeader({
  title,
  yearName,
  printedHebrew,
  printedGregorian,
  filters,
}: ReportPrintHeaderProps) {
  return (
    <header className="mb-6 hidden print:block">
      <div className="flex items-end justify-between gap-4 border-b-[3px] border-primary pb-3">
        <div>
          <p className="text-caption font-semibold tracking-[0.08em] text-secondary">
            מערכת ניהול נוכחות
          </p>
          <p className="mt-0.5 font-headline-md text-headline-md text-primary">
            נוכחות סמינר
          </p>
        </div>
        <div className="text-end text-caption text-on-surface-variant">
          <p className="font-semibold text-primary">{yearName}</p>
          <p>
            הודפס: {printedHebrew}
            <span className="mx-1 text-outline">·</span>
            {printedGregorian}
          </p>
        </div>
      </div>
      <div className="mt-4 border-b border-secondary pb-3">
        <h1 className="font-title-lg text-title-lg text-primary">{title}</h1>
        {filters.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-caption sm:grid-cols-3">
            {filters.map((item) => (
              <div key={item.label} className="flex gap-2">
                <dt className="shrink-0 text-on-surface-variant">{item.label}:</dt>
                <dd className="font-semibold text-on-surface">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

interface ReportPrintFooterProps {
  studentCount: number;
}

export function ReportPrintFooter({ studentCount }: ReportPrintFooterProps) {
  return (
    <footer className="mt-8 hidden break-inside-avoid print:block">
      <p className="text-caption text-on-surface-variant">
        {studentCount.toLocaleString("he-IL")} תלמידות בדוח · איחור נספר כנוכחות
      </p>
      <div className="mt-10 grid grid-cols-2 gap-16 text-body-md text-on-surface">
        <p>חתימת רכזת: ________________________</p>
        <p>חתימת מורה: ________________________</p>
      </div>
    </footer>
  );
}
