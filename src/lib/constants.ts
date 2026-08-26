import type { AttendanceStatus, OccurrenceStatus, RangeType } from "@/types/database";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "נוכחת",
  absent: "נעדרה",
  late: "איחור",
};

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  scheduled: "מתוכנן",
  completed: "הושלם",
  cancelled: "בוטל",
};

export const HOLIDAY_KIND_LABELS = {
  vacation: "חופשה",
  cancelled_studies: "ביטול לימודים",
} as const;

export const RANGE_TYPE_LABELS: Record<RangeType, string> = {
  annual: "שנתי",
  semester_a: "מחצית א'",
  semester_b: "מחצית ב'",
  course: "קורס",
};

export const BILLING_TYPE_LABELS = {
  mandatory: "חובה",
  specialization: "התמחות",
} as const;

export const DAY_OF_WEEK_LABELS = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
] as const;

export const NAV_ITEMS = [
  { href: "/", label: "לוח בקרה", icon: "home" },
  { href: "/students", label: "תלמידות", icon: "students" },
  { href: "/attendance", label: "נוכחות", icon: "attendance" },
  { href: "/makeup", label: "מבחני השלמה", icon: "makeup" },
  { href: "/timetable", label: "מערכת שעות", icon: "timetable" },
  { href: "/lessons", label: "שיעורים", icon: "lessons" },
  { href: "/teachers", label: "מורות", icon: "teachers" },
  { href: "/reports", label: "דוחות", icon: "reports" },
  { href: "/settings", label: "הגדרות", icon: "settings" },
] as const;

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-800 border-emerald-200",
  absent: "bg-rose-50 text-rose-800 border-rose-200",
  late: "bg-amber-50 text-amber-900 border-amber-200",
};

export const ATTENDANCE_CYCLE: AttendanceStatus[] = ["present", "absent", "late"];
