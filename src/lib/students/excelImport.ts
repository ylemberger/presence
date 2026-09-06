import "server-only";

import * as XLSX from "xlsx";
import { validateIsraeliId } from "@/lib/validation";
import { todayIso } from "@/lib/dates/hebrew";

export const STUDENT_IMPORT_HEADERS = [
  "מי",
  "שם פרטי",
  "משפחה",
  "כיתה",
  "מ.ז.",
  "ת.ל. עברי",
  "ת.ל. לועזי",
  "כתובת",
  "עיר",
  "טל",
  "פל אב",
  "פל אם",
  "פל תלמידה",
  "תיכון",
  "תוכנית חץ",
  "שכבה",
  "מסלול",
  "התמחות",
  "פסיכולוגיה",
  "התמחות נוספת",
  "מחזור",
  "בתוקף מתאריך",
] as const;

export const MAX_STUDENT_IMPORT_ROWS = 500;
export const MAX_STUDENT_IMPORT_BYTES = 3 * 1024 * 1024;

export type CanonicalStudentImportKey =
  | "mi"
  | "firstName"
  | "lastName"
  | "fullName"
  | "identity"
  | "birthHebrew"
  | "birthGregorian"
  | "address"
  | "city"
  | "phone"
  | "fatherPhone"
  | "motherPhone"
  | "studentPhone"
  | "highSchool"
  | "chetz"
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
  mi: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  identityNumber: string;
  birthDateHebrew: string | null;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  studentPhone: string | null;
  highSchool: string | null;
  chetzProgram: boolean;
  cohortNumber: number;
  gradeId: string;
  classId: string;
  trackId: string;
  specializationId: string;
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
  מי: "mi",
  "שם פרטי": "firstName",
  פרטי: "firstName",
  משפחה: "lastName",
  "שם משפחה": "lastName",
  "שם מלא": "fullName",
  שם: "fullName",
  "תעודת זהות": "identity",
  'ת"ז': "identity",
  "ת״ז": "identity",
  "ת.ז.": "identity",
  "ת.ז": "identity",
  "מ.ז.": "identity",
  "מ.ז": "identity",
  מז: "identity",
  תז: "identity",
  "ת.ל. עברי": "birthHebrew",
  "תל עברי": "birthHebrew",
  "ת.ל. לועזי": "birthGregorian",
  "תל לועזי": "birthGregorian",
  כתובת: "address",
  עיר: "city",
  טל: "phone",
  טלפון: "phone",
  "פל אב": "fatherPhone",
  "פל אם": "motherPhone",
  "פל תלמידה": "studentPhone",
  תיכון: "highSchool",
  "תוכנית חץ": "chetz",
  חץ: "chetz",
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

function parseOptionalFlag(raw: string, fieldLabel: string): boolean | { error: string } {
  const value = raw.trim().replace(/[\u200e\u200f\u202a-\u202e]/g, "");
  if (!value) return false;
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (["v", "✓", "✔", "√", "כן", "yes", "true", "1"].includes(normalized)) return true;
  if (["לא", "ללא", "בלי", "אין", "no", "false", "0", "-", "x"].includes(normalized)) return false;
  return { error: `בשדה ${fieldLabel}: ריק או ללא = לא, V = כן` };
}

function toIsoDate(year: number, month: number, day: number): string | { error: string } {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { error: "תאריך לא תקין" };
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { error: "תאריך לא תקין" };
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandTwoDigitYear(yy: number): number {
  return yy <= 29 ? 2000 + yy : 1900 + yy;
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  מרס: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

function replaceMonthNames(raw: string): string {
  let text = raw;
  const names = Object.keys(MONTH_NAME_TO_NUMBER).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const month = MONTH_NAME_TO_NUMBER[name];
    text = text.replace(new RegExp(name, "gi"), ` ${month} `);
  }
  return text;
}

function interpretThreeNumbers(a: number, b: number, c: number): string | { error: string } {
  if (a >= 1900 && a <= 2100) {
    const ymd = toIsoDate(a, b, c);
    if (typeof ymd === "string") return ymd;
    return toIsoDate(a, c, b);
  }
  const year = c >= 100 ? c : expandTwoDigitYear(c);
  const dmy = toIsoDate(year, b, a);
  if (typeof dmy === "string") return dmy;
  return toIsoDate(year, a, b);
}

function parseExcelSerial(raw: string): string | { error: string } | null {
  if (!/^\d{4,6}(?:\.\d+)?$/.test(raw)) return null;
  const parsed = XLSX.SSF.parse_date_code(Number(raw));
  if (!parsed?.y || !parsed.m || !parsed.d) return null;
  const iso = toIsoDate(parsed.y, parsed.m, parsed.d);
  return typeof iso === "string" ? iso : null;
}

function parseCompactDigits(digits: string): string | { error: string } | null {
  if (digits.length === 8) {
    const ymd = toIsoDate(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
    if (typeof ymd === "string") return ymd;
    const dmy = toIsoDate(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)));
    if (typeof dmy === "string") return dmy;
    return null;
  }
  if (digits.length === 6) {
    const dmy = interpretThreeNumbers(
      Number(digits.slice(0, 2)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(4, 6))
    );
    if (typeof dmy === "string") return dmy;
  }
  return null;
}

/** Accepts messy Israeli/Excel date text and returns YYYY-MM-DD. */
function parseFlexibleIsoDate(raw: string): string | { error: string } {
  const value = raw.trim().replace(/[\u200e\u200f\u202a-\u202e]/g, "");
  if (!value) return { error: "חסר תאריך" };

  const withoutTime = value.replace(
    /[T\s,]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?.*$/i,
    ""
  ).trim();
  const withMonths = replaceMonthNames(withoutTime);
  const normalized = withMonths.replace(/[–—−]/g, "-").replace(/[\\]/g, "/").trim();

  const serial = parseExcelSerial(normalized.replace(/\s+/g, ""));
  if (serial) return serial;

  const compact = normalized.replace(/\D/g, "");
  if (/^\d{6,8}$/.test(compact) && !/\d+\D+\d+/.test(normalized)) {
    const parsedCompact = parseCompactDigits(compact);
    if (parsedCompact) return parsedCompact;
  }

  const numbers = (normalized.match(/\d+/g) ?? []).map((part) => Number(part));
  const yearIndex = numbers.findIndex((n) => n >= 1900 && n <= 2100);
  if (yearIndex >= 0 && numbers.length >= 3) {
    const triple =
      yearIndex === 0
        ? [numbers[0], numbers[1], numbers[2]]
        : [numbers[yearIndex - 2], numbers[yearIndex - 1], numbers[yearIndex]];
    if (triple.every((n) => Number.isFinite(n))) {
      const parsed = interpretThreeNumbers(triple[0], triple[1], triple[2]);
      if (typeof parsed === "string") return parsed;
    }
  }
  if (numbers.length >= 3) {
    const parsed = interpretThreeNumbers(numbers[0], numbers[1], numbers[2]);
    if (typeof parsed === "string") return parsed;
  }

  if (numbers.length === 1) {
    const one = String(numbers[0]);
    const asSerial = parseExcelSerial(one);
    if (asSerial) return asSerial;
    const asCompact = parseCompactDigits(one);
    if (asCompact) return asCompact;
  }

  if (compact.length === 8 || compact.length === 6) {
    const parsedCompact = parseCompactDigits(compact);
    if (parsedCompact) return parsedCompact;
  }

  return { error: "תאריך לא מזוהה" };
}

function normalizePhoneList(raw: string): string | null {
  const parts = raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
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

  const hasName =
    columnIndex.has("fullName") ||
    (columnIndex.has("firstName") && columnIndex.has("lastName"));
  if (!hasName || !columnIndex.has("identity") || !columnIndex.has("className")) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message:
            "חסרות עמודות חובה: שם פרטי+משפחה (או שם מלא), מ.ז., כיתה. מומלץ גם מסלול, התמחות, שכבה.",
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

    const firstNameRaw = get("firstName");
    const lastNameRaw = get("lastName");
    const fullNameRaw = get("fullName");
    let firstName = firstNameRaw;
    let lastName = lastNameRaw;
    let fullName = fullNameRaw;
    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
    }
    if ((!firstName || !lastName) && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      firstName = firstName || parts[0] || "";
      lastName = lastName || parts.slice(1).join(" ") || "";
    }

    const identityRaw = get("identity");
    const cohortRaw = get("cohort");
    const gradeName = get("grade");
    const className = get("className");
    const trackName = get("track");
    const specName = get("specialization");
    const secondarySpecName = get("secondarySpecialization");
    const psychologyRaw = get("psychology");
    const startDateRaw = get("startDate");
    const mi = get("mi") || null;
    const birthGregorianRaw = get("birthGregorian");
    const address = get("address") || null;
    const city = get("city") || null;
    const phone = normalizePhoneList(get("phone"));
    const fatherPhone = normalizePhoneList(get("fatherPhone"));
    const motherPhone = normalizePhoneList(get("motherPhone"));
    const studentPhone = normalizePhoneList(get("studentPhone"));
    const highSchool = get("highSchool") || null;
    const chetzRaw = get("chetz");

    const empty =
      !fullName &&
      !firstName &&
      !lastName &&
      !identityRaw &&
      !className &&
      !trackName;
    if (empty) continue;

    const rowErrors: string[] = [];
    if (!firstName || !lastName) rowErrors.push("חסרים שם פרטי ומשפחה");

    const identity = validateIsraeliId(identityRaw);
    if (typeof identity !== "string") rowErrors.push(identity.error);

    let cohortNumber = 1;
    if (cohortRaw) {
      cohortNumber = parseInt(cohortRaw.replace(/\D/g, ""), 10);
      if (Number.isNaN(cohortNumber) || cohortNumber < 1) {
        rowErrors.push("מחזור חייב להיות מספר שלם מ-1 ומעלה");
        cohortNumber = 1;
      }
    }

    let classRow =
      catalogs.classes.find(
        (c) => c.name.trim().replace(/\s+/g, " ") === className.trim().replace(/\s+/g, " ")
      ) ?? undefined;
    let grade =
      (gradeName ? lookupByName(catalogs.grades, gradeName) : undefined) ??
      (classRow ? catalogs.grades.find((g) => g.id === classRow!.grade_id) : undefined);

    if (gradeName && !lookupByName(catalogs.grades, gradeName)) {
      rowErrors.push(`שכבה לא נמצאה בהגדרות: ${gradeName}`);
    }
    if (!className) rowErrors.push("חסרה כיתה");
    else {
      const matches = catalogs.classes.filter(
        (c) => c.name.trim().replace(/\s+/g, " ") === className.trim().replace(/\s+/g, " ")
      );
      if (grade) {
        classRow = matches.find((c) => c.grade_id === grade!.id);
        if (!classRow) rowErrors.push(`כיתה לא נמצאה בשכבה ${grade.name}: ${className}`);
      } else if (matches.length === 1) {
        classRow = matches[0];
        grade = catalogs.grades.find((g) => g.id === classRow!.grade_id);
      } else if (matches.length === 0) {
        rowErrors.push(`כיתה לא נמצאה בהגדרות: ${className}`);
      } else {
        rowErrors.push(`כיתה ${className} קיימת בכמה שכבות — מלאי גם עמודת שכבה`);
      }
    }
    if (!grade && !rowErrors.some((e) => e.includes("שכבה") || e.includes("כיתה"))) {
      rowErrors.push("לא ניתן לקבוע שכבה — מלאי שכבה או כיתה חד־משמעית");
    }

    const track = lookupByName(catalogs.tracks, trackName);
    if (!trackName) rowErrors.push("חסר מסלול");
    else if (!track) rowErrors.push(`מסלול לא נמצא בהגדרות: ${trackName}`);

    let specializationId: string | null = null;
    if (!specName) {
      rowErrors.push("חסרה התמחות");
    } else {
      const spec = lookupByName(catalogs.specializations, specName);
      if (!spec) rowErrors.push(`התמחות לא נמצאה בהגדרות: ${specName}`);
      else specializationId = spec.id;
    }

    let secondarySpecializationId: string | null = null;
    if (secondarySpecName) {
      const spec = lookupByName(catalogs.specializations, secondarySpecName);
      if (!spec) rowErrors.push(`התמחות נוספת לא נמצאה בהגדרות: ${secondarySpecName}`);
      else if (specializationId && spec.id === specializationId) {
        rowErrors.push("התמחות נוספת חייבת להיות שונה מההתמחות הראשית");
      } else secondarySpecializationId = spec.id;
    }

    const psychology = parseOptionalFlag(psychologyRaw, "פסיכולוגיה");
    if (typeof psychology !== "boolean") rowErrors.push(psychology.error);

    const chetz = parseOptionalFlag(chetzRaw, "תוכנית חץ");
    if (typeof chetz !== "boolean") rowErrors.push(chetz.error);

    let birthDate: string | null = null;
    const birthGregorian = birthGregorianRaw.trim();
    if (birthGregorian) {
      const parsedBirth = parseFlexibleIsoDate(birthGregorian);
      if (typeof parsedBirth === "string") birthDate = parsedBirth;
      else rowErrors.push(`ת.ל. לועזי: ${parsedBirth.error}`);
    }
    const birthHebrew = (get("birthHebrew") || "").trim() || null;

    const startDate = startDateRaw
      ? parseFlexibleIsoDate(startDateRaw)
      : defaultStartDate;
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
      mi,
      firstName,
      lastName,
      fullName,
      identityNumber: identity as string,
      birthDateHebrew: birthHebrew,
      birthDate,
      address,
      city,
      phone,
      fatherPhone,
      motherPhone,
      studentPhone,
      highSchool,
      chetzProgram: chetz as boolean,
      cohortNumber,
      gradeId: grade!.id,
      classId: classRow!.id,
      trackId: track!.id,
      specializationId: specializationId as string,
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
  const exampleSpec = catalogs.specializations[0]?.name ?? "חינוך";

  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...STUDENT_IMPORT_HEADERS],
    [
      "",
      "רחל",
      "כהן",
      exampleClass,
      "123456789",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      exampleGrade,
      exampleTrack,
      exampleSpec,
      "",
      "",
      1,
      todayIso(),
    ],
  ]);
  dataSheet["!cols"] = STUDENT_IMPORT_HEADERS.map((header) => ({
    wch: Math.max(12, header.length + 2),
  }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "תלמידות");

  const allowed: (string | number)[][] = [
    ["הנחיות לייבוא תלמידות"],
    ["1. מחקי את שורת הדוגמה ומלאי תלמידות אמיתיות."],
    ["2. אם מ.ז. כבר קיימת — הפרטים והשיבוץ יעודכנו (לא כפילות)."],
    ["3. כיתה/מסלול/התמחות חייבים להתאים להגדרות השנה. שכבה מומלצת אם יש כיתות באותו שם."],
    ["4. ת.ל. עברי ות.ל. לועזי — רשות. אפשר להשאיר ריק. לועזי מזוהה גם בפורמט לא אחיד (נקודות, קווים, סלאש, שמות חודשים, שנה קצרה, מספר אקסל)."],
    ["5. פסיכולוגיה ותוכנית חץ — רשות. ריק או ללא = לא, V = כן (גם כן/לא מתקבל)."],
    ["6. טל, פל אב, פל אם, פל תלמידה — רשות. אפשר כמה מספרים מופרדים בפסיק."],
    ["7. מחזור ובתוקף מתאריך — רשות (ברירת מחדל: מחזור 1, היום)."],
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
      catalogs.specializations.map((s) => s.name).join(" | ") || "אין — חובה להגדיר התמחות",
    ],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(allowed);
  helpSheet["!cols"] = [{ wch: 18 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, helpSheet, "הנחיות");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
