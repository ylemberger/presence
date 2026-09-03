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

/** שני איחורים = חיסור אחד; איחור בודד שנשאר נספר כנוכחות. */
export function effectiveAbsentCount(absentCount: number, lateCount: number): number {
  return absentCount + Math.floor(Math.max(0, lateCount) / 2);
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
  const effectiveAbsent = effectiveAbsentCount(absentCount, lateCount);

  return {
    totalRequired: required.length,
    absentCount,
    lateCount,
    leftoverLate: lateCount % 2,
    effectiveAbsentCount: effectiveAbsent,
    presentOnlyCount,
    presentCount,
    unmarked,
    absencePercent: calculateAbsencePercent({
      totalRequired: required.length,
      absentCount: effectiveAbsent,
    }),
  };
}

export type AttendanceSummary = ReturnType<typeof summarizeAttendance>;

/** מאחד יחידות חישוב נפרדות — איחור עודף בשיעור אחד לא מזווג עם איחור בשיעור אחר. */
export function combineAttendanceSummaries(parts: AttendanceSummary[]): AttendanceSummary {
  const totalRequired = parts.reduce((s, p) => s + p.totalRequired, 0);
  const absentCount = parts.reduce((s, p) => s + p.absentCount, 0);
  const lateCount = parts.reduce((s, p) => s + p.lateCount, 0);
  const leftoverLate = parts.reduce((s, p) => s + p.leftoverLate, 0);
  const effectiveAbsent = parts.reduce((s, p) => s + p.effectiveAbsentCount, 0);
  const presentOnlyCount = parts.reduce((s, p) => s + p.presentOnlyCount, 0);
  const presentCount = parts.reduce((s, p) => s + p.presentCount, 0);
  const unmarked = parts.reduce((s, p) => s + p.unmarked, 0);
  return {
    totalRequired,
    absentCount,
    lateCount,
    leftoverLate,
    effectiveAbsentCount: effectiveAbsent,
    presentOnlyCount,
    presentCount,
    unmarked,
    absencePercent: calculateAbsencePercent({
      totalRequired,
      absentCount: effectiveAbsent,
    }),
  };
}

/** איחור: כל זוג = חיסור; איחור יחיד שנשאר = נוכחות. */
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

export type MakeupTier = "tier1" | "tier2" | "blocked";

export interface MakeupEvaluation {
  /** האם קיימת דרישת מבחן השלמה לפי חוקי המערכת */
  tier: MakeupTier | "none";
  /** 0 = חסומה/אין אפשרות להשלים */
  requiredExams: 0 | 1 | 2;
  /** תצוגה בלבד: "חסומה" */
  isBlocked: boolean;
  label: string;
  /** absencePercent / maxAllowed */
  ratio: number;
}

/**
 * כללי מבחני השלמה:
 * - מעל 1.2× מהסף → 1 מבחן השלמה
 * - מעל 1.4× מהסף → 2 מבחנים
 * - מעל 1.6× מהסף → חסומה (הערה מודגשת, אין אפשרות להשלים)
 */
export function evaluateMakeupRequirement(
  absencePercent: number,
  maxAllowedPercent: number | null | undefined
): MakeupEvaluation {
  const max = maxAllowedPercent == null ? NaN : Number(maxAllowedPercent);
  if (Number.isNaN(max) || max <= 0) {
    return {
      tier: "none",
      requiredExams: 0,
      isBlocked: false,
      label: "אין כלל נוכחות לחישוב מבחני השלמה",
      ratio: 0,
    };
  }

  const ratio = absencePercent / max;
  if (ratio > 1.6) {
    return {
      tier: "blocked",
      requiredExams: 0,
      isBlocked: true,
      label: "חריגה מעל 60% — אין איך להשלים",
      ratio,
    };
  }

  if (ratio > 1.4) {
    return {
      tier: "tier2",
      requiredExams: 2,
      isBlocked: false,
      label: "חריגה מעל 40% — 2 מבחנים",
      ratio,
    };
  }

  if (ratio > 1.2) {
    return {
      tier: "tier1",
      requiredExams: 1,
      isBlocked: false,
      label: "חריגה מעל 20% — מבחן השלמה",
      ratio,
    };
  }

  return {
    tier: "none",
    requiredExams: 0,
    isBlocked: false,
    label: "אין צורך במבחני השלמה",
    ratio,
  };
}
