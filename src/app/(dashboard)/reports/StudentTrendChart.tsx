interface MonthBar {
  label: string;
  present: number;
  late: number;
  absent: number;
}

interface StudentTrendChartProps {
  months: MonthBar[];
}

export function StudentTrendChart({ months }: StudentTrendChartProps) {
  if (months.length === 0) return null;

  const max = Math.max(
    1,
    ...months.map((m) => m.present + m.late + m.absent)
  );
  const height = 120;
  const barWidth = 36;
  const gap = 16;
  const width = months.length * (barWidth + gap) + gap;

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-stone-100 bg-stone-50/50 p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">מגמת נוכחות לפי חודש</p>
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        className="h-40 w-full min-w-[240px]"
        role="img"
        aria-label="גרף מגמת נוכחות"
      >
        {months.map((m, i) => {
          const x = gap + i * (barWidth + gap);
          const total = m.present + m.late + m.absent;
          const scale = total > 0 ? height / max : 0;
          const hPresent = m.present * scale;
          const hLate = m.late * scale;
          const hAbsent = m.absent * scale;
          let y = height;
          y -= hPresent;
          const yPresent = y;
          y -= hLate;
          const yLate = y;
          y -= hAbsent;
          const yAbsent = y;

          return (
            <g key={m.label}>
              {hAbsent > 0 && (
                <rect x={x} y={yAbsent} width={barWidth} height={hAbsent} fill="#f43f5e" rx={2} />
              )}
              {hLate > 0 && (
                <rect x={x} y={yLate} width={barWidth} height={hLate} fill="#fbbf24" rx={2} />
              )}
              {hPresent > 0 && (
                <rect x={x} y={yPresent} width={barWidth} height={hPresent} fill="#10b981" rx={2} />
              )}
              <text
                x={x + barWidth / 2}
                y={height + 16}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize={10}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> נוכחת
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> איחור
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> נעדרה
        </span>
      </div>
    </div>
  );
}
