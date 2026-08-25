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

export interface ReportCsvLessonRow {
  subject: string;
  teacherName: string;
  dayLabel: string;
  totalRequired: number;
  presentOnlyCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  absencePercent: number;
}

export interface ReportCsvOccurrenceRow {
  date: string;
  totalRequired: number;
  presentOnlyCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  studentStatus?: string;
}

export interface ReportCsvOccurrenceStudentRow {
  studentName: string;
  gradeName: string;
  className: string;
  status: string;
}

interface ExportCsvButtonProps {
  rows: ReportCsvRow[];
  lessonRows?: ReportCsvLessonRow[];
  occurrenceRows?: ReportCsvOccurrenceRow[];
  occurrenceStudentRows?: ReportCsvOccurrenceStudentRow[];
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
  lessonRows = [],
  occurrenceRows = [],
  occurrenceStudentRows = [],
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
    if (lessonRows.length > 0) {
      lines.push("");
      lines.push("שיעורים");
      lines.push(
        ["מקצוע", "מורה", "יום", "מופעים", "נוכחת", "איחור", "נעדרה", "לא סומן", "אחוז היעדרות"].join(
          ","
        )
      );
      for (const d of lessonRows) {
        lines.push(
          [
            d.subject,
            d.teacherName,
            d.dayLabel,
            d.totalRequired,
            d.presentOnlyCount,
            d.lateCount,
            d.absentCount,
            d.unmarkedCount,
            `${d.absencePercent}%`,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }
    if (occurrenceRows.length > 0) {
      lines.push("");
      lines.push("מופעי השיעור");
      lines.push(
        ["תאריך", "תלמידות", "נוכחת", "איחור", "נעדרה", "לא סומן", "סטטוס תלמידה"].join(",")
      );
      for (const d of occurrenceRows) {
        lines.push(
          [
            d.date,
            d.totalRequired,
            d.presentOnlyCount,
            d.lateCount,
            d.absentCount,
            d.unmarkedCount,
            d.studentStatus ?? "",
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }
    if (occurrenceStudentRows.length > 0) {
      lines.push("");
      lines.push("נוכחות במופע");
      lines.push(["תלמידה", "שכבה", "כיתה", "סטטוס"].join(","));
      for (const d of occurrenceStudentRows) {
        lines.push(
          [d.studentName, d.gradeName, d.className, d.status].map(escapeCsv).join(",")
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
    <Button type="button" variant="secondary" size="sm" onClick={download} disabled={rows.length === 0 && lessonRows.length === 0}>
      ייצוא Excel (CSV)
    </Button>
  );
}
