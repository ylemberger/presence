import { SEMINAR_LOGO_DATA_URI } from "./seminar-logo";

/** Print-only seminar brand. Logo is inlined so NetFree cannot block /logo.png. */
export function SeminarPrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="seminar-print-header hidden print:flex">
      <div className="flex items-center gap-4">
        {/* Native img + data URI: no HTTP fetch during print. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SEMINAR_LOGO_DATA_URI} alt="סמינר" />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-secondary">
            נוכחות סמינר
          </p>
          <p className="font-headline-md text-headline-md text-primary">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
