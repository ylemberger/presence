import "server-only";

import * as XLSX from "xlsx";
import { validateIsraeliId } from "@/lib/validation";
import { todayIso } from "@/lib/dates/hebrew";

export const STUDENT_IMPORT_HEADERS = [
  "שם מלא",
  "תעודת זהות",
  "מחזור",
  "שכבה",
  "כיתה",
  "מסלול",
  "התמחות",
  "התמחות נוספת",
  "פסיכולוגיה",
  "בתוקף מתאריך",
] as const;

export const MAX_STUDENT_IMPORT_ROWS = 500;
export const MAX_STUDENT_IMPORT_BYTES = 3 * 1024 * 1024;

export type CanonicalStudentImportKey =
  | "fullName"
  | "identity"
  | "cohort"
  | "grade"
  | "className"
  | "track"
  | "specialization"
  | "secondarySpecialization"
  | "psychology"
  | "startDate";

export interface StudentImportCatalogs {
  grades: { id: string; name: string }[];
  classes: { id: string; name: string; grade_id: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
}

export interface ParsedStudentImportRow {
  rowNumber: number;
  fullName: string;
  identityNumber: string;
  cohortNumber: number;
  gradeId: string;
  classId: string;
  trackId: string;
  specializationId: string | null;
  secondarySpecializationId: string | null;
  isPsychology: boolean;
  startDate: string;
}

export interface StudentImportParseError {
  rowNumber: number;
  message: string;
}

export interface StudentImportParseResult {
  rows: ParsedStudentImportRow[];
  errors: StudentImportParseError[];
}

const HEADER_ALIASES: Record<string, CanonicalStudentImportKey> = {
  "שם מלא": "fullName",
  שם: "fullName",
  "תעודת זהות": "identity",
  'ת"ז': "identity",
  "ת״ז": "identity",
  "ת.ז.": "identity",
  "ת.ז": "identity",
  תז: "identity",
  מחזור: "cohort",
  שכבה: "grade",
  כיתה: "className",
  מסלול: "track",
  התמחות: "specialization",
  "התמחות נוספת": "secondarySpecialization",
  פסיכולוגיה: "psychology",
  "בתוקף מתאריך": "startDate",
  מתאריך: "startDate",
  "תאריך התחלה": "startDate",
};

function normalizeHeader(raw: string): string {
  return raw
    .replace(/["״׳']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).trim();
}

function lookupByName<T extends { id: string; name: string }>(
  items: T[],
  name: string
): T | undefined {
  const needle = name.trim().replace(/\s+/g, " ");
  return items.find((item) => item.name.trim().replace(/\s+/g, " ") === needle);
}

function parsePsychology(raw: string): boolean | { error: string } {
  const value = raw.trim();
  if (!value) return false;
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (["כן", "yes", "true", "1", "v", "✓"].includes(normalized)) return true;
  if (["לא", "no", "false", "0"].includes(normalized)) return false;
  return { error: 'בשדה פסיכולוגיה יש למלא "כן" או "לא"' };
}

function parseStartDate(raw: string, fallback: string): string | { error: string } {
  const value = raw.trim();
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dotted = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dotted) {
    const day = dotted[1].padStart(2, "0");
    const month = dotted[2].padStart(2, "0");
    return `${dotted[3]}-${month}-${day}`;
  }
  if (/^\d{5}$/.test(value)) {
    const parsed = XLSX.SSF.parse_date_code(Number(value));
    if (parsed?.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  return { error: "תאריך חייב להיות YYYY-MM-DD או DD.MM.YYYY" };
}

export function parseStudentImportWorkbook(
  bytes: ArrayBuffer,
  filename: string,
  catalogs: StudentImportCatalogs,
  defaultStartDate = todayIso()
): StudentImportParseResult {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string" })
    : XLSX.read(bytes, { type: "array", cellDates: true });

  const preferred =
    workbook.SheetNames.find((name) => name.includes("תלמידות")) ?? workbook.SheetNames[0];
  if (!preferred) {
    return { rows: [], errors: [{ rowNumber: 0, message: "הקובץ ריק" }] };
  }

  const sheet = workbook.Sheets[preferred];
  const table = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  if (table.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: "לא נמצאו שורות בקובץ" }] };
  }

  const headerRow = (table[0] ?? []).map((cell) => normalizeHeader(cellToString(cell)));
  const columnIndex = new Map<CanonicalStudentImportKey, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = HEADER_ALIASES[headerRow[i]];
    if (key && !columnIndex.has(key)) columnIndex.set(key, i);
  }

  const required: CanonicalStudentImportKey[] = [
    "fullName",
    "identity",
    "cohort",
    "grade",
    "className",
    "track",
  ];
  const missing = required.filter((key) => !columnIndex.has(key));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `חסרות עמודות חובה: ${missing
            .map((key) => {
              const label = STUDENT_IMPORT_HEADERS.find((header) => HEADER_ALIASES[header] === key);
              return label ?? key;
            })
            .join(", ")}`,
        },
      ],
    };
  }

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_STUDENT_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message: `אפשר לייבא עד ${MAX_STUDENT_IMPORT_ROWS} תלמידות בקובץ אחד`,
        },
      ],
    };
  }

  const rows: ParsedStudentImportRow[] = [];
  const errors: StudentImportParseError[] = [];
  const seenIds = new Map<string, number>();

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow = dataRows[i] ?? [];
    const rowNumber = i + 2;
    const get = (key: CanonicalStudentImportKey) => {
      const index = columnIndex.get(key);
      return index == null ? "" : cellToString(rawRow[index]);
    };

    const fullName = get("fullName");
    const identityRaw = get("identity");
    const cohortRaw = get("cohort");
    const gradeName = get("grade");
    const className = get("className");
    const trackName = get("track");
    const specName = get("specialization");
    const secondarySpecName = get("secondarySpecialization");
    const psychologyRaw = get("psychology");
    const startDateRaw = get("startDate");

    const empty =
      !fullName &&
      !identityRaw &&
      !cohortRaw &&
      !gradeName &&
      !className &&
      !trackName &&
      !specName &&
      !secondarySpecName &&
      !psychologyRaw &&
      !startDateRaw;
    if (empty) continue;

    const rowErrors: string[] = [];
    if (!fullName) rowErrors.push("חסר שם מלא");

    const identity = validateIsraeliId(identityRaw);
    if (typeof identity !== "string") rowErrors.push(identity.error);

    const cohortNumber = parseInt(cohortRaw.replace(/\D/g, ""), 10);
    if (!cohortRaw || Number.isNaN(cohortNumber) || cohortNumber < 1) {
      rowErrors.push("מחזור חייב להיות מספר שלם מ-1 ומעלה");
    }

    const grade = lookupByName(catalogs.grades, gradeName);
    if (!gradeName) rowErrors.push("חסרה שכבה");
    else if (!grade) rowErrors.push(`שכבה לא נמצאה בהגדרות: ${gradeName}`);

    const classRow = lookupByName(catalogs.classes, className);
    if (!className) rowErrors.push("חסרה כיתה");
    else if (!classRow) rowErrors.push(`כיתה לא נמצאה בהגדרות: ${className}`);
    else if (grade && classRow.grade_id !== grade.id) {
      rowErrors.push(`הכיתה ${className} אינה שייכת לשכבה ${gradeName}`);
    }

    const track = lookupByName(catalogs.tracks, trackName);
    if (!trackName) rowErrors.push("חסר מסלול");
    else if (!track) rowErrors.push(`מסלול לא נמצא בהגדרות: ${trackName}`);

    let specializationId: string | null = null;
    if (specName) {
      const spec = lookupByName(catalogs.specializations, specName);
      if (!spec) rowErrors.push(`התמחות לא נמצאה בהגדרות: ${specName}`);
      else specializationId = spec.id;
    }

    let secondarySpecializationId: string | null = null;
    if (secondarySpecName) {
      const spec = lookupByName(catalogs.specializations, secondarySpecName);
      if (!spec) rowErrors.push(`התמחות נוספת לא נמצאה בהגדרות: ${secondarySpecName}`);
      else secondarySpecializationId = spec.id;
    }

    const psychology = parsePsychology(psychologyRaw);
    if (typeof psychology !== "boolean") rowErrors.push(psychology.error);

    const startDate = parseStartDate(startDateRaw, defaultStartDate);
    if (typeof startDate !== "string") rowErrors.push(startDate.error);

    if (typeof identity === "string") {
      const previous = seenIds.get(identity);
      if (previous) {
        rowErrors.push(`תעודת זהות כפולה בקובץ (גם בשורה ${previous})`);
      } else {
        seenIds.set(identity, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, message: rowErrors.join(" · ") });
      continue;
    }

    rows.push({
      rowNumber,
      fullName,
      identityNumber: identity as string,
      cohortNumber,
      gradeId: grade!.id,
      classId: classRow!.id,
      trackId: track!.id,
      specializationId,
      secondarySpecializationId,
      isPsychology: psychology as boolean,
      startDate: startDate as string,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ rowNumber: 0, message: "אין שורות תלמידות למילוי בקובץ" });
  }

  return { rows, errors };
}

export function buildStudentImportTemplate(catalogs: StudentImportCatalogs): Uint8Array {
  const exampleGrade = catalogs.grades[0]?.name ?? "א";
  const exampleClass =
    catalogs.classes.find((c) => c.grade_id === catalogs.grades[0]?.id)?.name ??
    catalogs.classes[0]?.name ??
    "א1";
  const exampleTrack = catalogs.tracks[0]?.name ?? "כללי";
  const exampleSpec = catalogs.specializations[0]?.name ?? "";

  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...STUDENT_IMPORT_HEADERS],
    [
      "דוגמה כהן",
      "123456789",
      1,
      exampleGrade,
      exampleClass,
      exampleTrack,
      exampleSpec,
      "",
      "לא",
      todayIso(),
    ],
  ]);
  dataSheet["!cols"] = STUDENT_IMPORT_HEADERS.map((header) => ({
    wch: Math.max(14, header.length + 4),
  }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "תלמידות");

  const allowed: (string | number)[][] = [
    ["הנחיות לייבוא תלמידות"],
    ["1. מחקי את שורת הדוגמה ומלאי תלמידות אמיתיות."],
    ['2. אם תעודת זהות כבר קיימת במערכת — השם, המחזור והשיבוץ יעודכנו (לא תיווצר כפילות).'],
    ["3. שמות שכבה / כיתה / מסלול / התמחות חייבים להתאים בדיוק להגדרות השנה הפעילה."],
    ["4. פסיכולוגיה: כן או לא. תאריך: YYYY-MM-DD או DD.MM.YYYY. אם ריק — היום."],
    ["5. עמודת תעודת זהות עדיף כטקסט, כדי לשמור אפסים בתחילת המספר."],
    [],
    ["ערכים מותרים בשנה הפעילה"],
    ["שכבות", catalogs.grades.map((g) => g.name).join(" | ") || "אין"],
    [
      "כיתות",
      catalogs.classes
        .map((c) => {
          const gradeName = catalogs.grades.find((g) => g.id === c.grade_id)?.name ?? "";
          return gradeName ? `${c.name} (${gradeName})` : c.name;
        })
        .join(" | ") || "אין",
    ],
    ["מסלולים", catalogs.tracks.map((t) => t.name).join(" | ") || "אין"],
    [
      "התמחויות",
      catalogs.specializations.map((s) => s.name).join(" | ") || "אין (אפשר להשאיר ריק)",
    ],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(allowed);
  helpSheet["!cols"] = [{ wch: 18 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, helpSheet, "הנחיות");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
