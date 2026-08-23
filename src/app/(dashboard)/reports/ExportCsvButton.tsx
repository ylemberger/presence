"use client";

import { Button } from "@/components/ui/Button";

export interface ReportCsvRow {
  studentName: string;
  className: string;
  totalRequired: number;
  presentOnlyCount: number;
  lateCount: number;
  absentCount: number;
  absencePercent: number;
  ruleLabel: string;
}

interface ExportCsvButtonProps {
  rows: ReportCsvRow[];
  filename?: string;
  title?: string;
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportCsvButton({
  rows,
  filename = "attendance-report.csv",
  title = "דוח נוכחות",
}: ExportCsvButtonProps) {
  function download() {
    const headers = [
      "תלמידה",
      "כיתה",
      "שיעורים",
      "נוכחת",
      "איחור",
      "נעדרה",
      "אחוז היעדרות",
      "סטטוס",
    ];
    const lines = [
      title,
      headers.join(","),
      ...rows.map((r) =>
        [
          r.studentName,
          r.className,
          r.totalRequired,
          r.presentOnlyCount,
          r.lateCount,
          r.absentCount,
          `${r.absencePercent}%`,
          r.ruleLabel,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={download} disabled={rows.length === 0}>
      ייצוא Excel (CSV)
    </Button>
  );
}
