"use client";

import { Button } from "@/components/ui/Button";

export interface ReportCsvRow {
  studentName: string;
  gradeName?: string;
  className: string;
  totalRequired: number;
  presentOnlyCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount?: number;
  absencePercent: number;
  ruleLabel: string;
}

export interface ReportCsvDetailRow {
  studentName: string;
  gradeName: string;
  className: string;
  date: string;
  subject: string;
  teacherName: string;
  status: string;
}

interface ExportCsvButtonProps {
  rows: ReportCsvRow[];
  detailRows?: ReportCsvDetailRow[];
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
  detailRows = [],
  filename = "attendance-report.csv",
  title = "דוח נוכחות",
}: ExportCsvButtonProps) {
  function download() {
    const headers = [
      "תלמידה",
      "שכבה",
      "כיתה",
      "שיעורים",
      "נוכחת",
      "איחור",
      "נעדרה",
      "לא סומן",
      "אחוז היעדרות",
      "סטטוס",
    ];
    const lines = [
      title,
      headers.join(","),
      ...rows.map((r) =>
        [
          r.studentName,
          r.gradeName ?? "",
          r.className,
          r.totalRequired,
          r.presentOnlyCount,
          r.lateCount,
          r.absentCount,
          r.unmarkedCount ?? "",
          `${r.absencePercent}%`,
          r.ruleLabel,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];
    if (detailRows.length > 0) {
      lines.push("");
      lines.push("פירוט שיעורים");
      lines.push(["תלמידה", "שכבה", "כיתה", "תאריך", "מקצוע", "מורה", "סטטוס"].join(","));
      for (const d of detailRows) {
        lines.push(
          [
            d.studentName,
            d.gradeName,
            d.className,
            d.date,
            d.subject,
            d.teacherName,
            d.status,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }
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
