import { Icon } from "@/components/ui/Icon";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16" aria-live="polite">
      <Icon name="sync" className="animate-spin text-[28px] text-primary" />
      <p className="font-title-lg text-title-lg text-primary">בודקת נתונים…</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        ממתינה לרשימות ולשיעורים. השמירה לא נעצרת.
      </p>
    </div>
  );
}
