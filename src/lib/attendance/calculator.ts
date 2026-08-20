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
  const presentCount = required.filter(
    (o) => o.attendanceStatus && countsAsPresent(o.attendanceStatus)
  ).length;
  const unmarked = required.filter((o) => !o.attendanceStatus).length;

  return {
    totalRequired: required.length,
    absentCount,
    presentCount,
    unmarked,
    absencePercent: calculateAbsencePercent({ totalRequired: required.length, absentCount }),
  };
}
