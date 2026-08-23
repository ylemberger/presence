export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="טוען עמוד">
      <div className="space-y-2">
        <div className="h-1 w-10 rounded-full bg-[var(--accent)]/40" />
        <div className="h-8 w-48 rounded-xl bg-slate-200/80" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-slate-200/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-36 rounded-2xl border border-[var(--border)] bg-white/80" />
        <div className="h-36 rounded-2xl border border-[var(--border)] bg-white/80" />
        <div className="h-36 rounded-2xl border border-[var(--border)] bg-white/80" />
      </div>
      <div className="h-64 rounded-2xl border border-[var(--border)] bg-white/80" />
    </div>
  );
}
