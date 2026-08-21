import type { AttendanceStatus } from "@/types/database";

export interface AttendanceCalcInput {
  totalRequired: number;
  absentCount: number;
}

export function calculateAbsencePercent(input: AttendanceCalcInput): number {
  if (input.totalRequired === 0) return 0;
  return Math.round((input.absentCount / input.totalRequired) * 10000) / 100;
}

export function countsAsPresent(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
}

export function countsAsAbsent(status: AttendanceStatus): boolean {
  return status === "absent";
}

export interface EligibleOccurrence {
  occurrenceId: string;
  occurrenceDate: string;
  status: string;
  attendanceStatus?: AttendanceStatus;
}

export function summarizeAttendance(occurrences: EligibleOccurrence[]) {
  const required = occurrences.filter((o) => o.status !== "cancelled");
  const absentCount = required.filter((o) => o.attendanceStatus === "absent").length;
  const lateCount = required.filter((o) => o.attendanceStatus === "late").length;
  const presentOnlyCount = required.filter((o) => o.attendanceStatus === "present").length;
  const presentCount = required.filter(
    (o) => o.attendanceStatus && countsAsPresent(o.attendanceStatus)
  ).length;
  const unmarked = required.filter((o) => !o.attendanceStatus).length;

  return {
    totalRequired: required.length,
    absentCount,
    lateCount,
    presentOnlyCount,
    presentCount,
    unmarked,
    absencePercent: calculateAbsencePercent({ totalRequired: required.length, absentCount }),
  };
}

/** איחור נספר כנוכחות; רק `absent` נכנס לאחוז היעדרות. */
export type AbsenceRuleLevel = "ok" | "warning" | "blocked";

export function evaluateAbsenceAgainstRule(
  absencePercent: number,
  maxAllowedPercent: number | null | undefined
): { level: AbsenceRuleLevel; label: string; isExceeded: boolean } {
  if (maxAllowedPercent == null || Number.isNaN(Number(maxAllowedPercent))) {
    return { level: "ok", label: "תקין", isExceeded: false };
  }

  const max = Number(maxAllowedPercent);
  if (absencePercent > max) {
    return {
      level: "blocked",
      label: `חריגה מ-${max}%`,
      isExceeded: true,
    };
  }

  if (max > 0 && absencePercent >= max * 0.8) {
    return {
      level: "warning",
      label: `קרוב לסף (${max}%)`,
      isExceeded: false,
    };
  }

  return { level: "ok", label: "תקין", isExceeded: false };
}
