/* eslint-disable */
/**
 * מייצר קבצי דמו לייבוא תלמידות (כל העמודות החדשות).
 * הרצה: node demo-import/generate-demo-students.js
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const headers = [
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
];

const firstNames = [
  "רחל", "שרה", "מרים", "חנה", "רבקה", "לאה", "אסתר", "דינה",
  "יעל", "תמר", "נעמי", "ברכה", "פייגי", "מלכה", "רותי", "גיטי",
  "ציפורה", "גולדה", "בתיה", "שולמית", "הדסה", "אסנת", "יהודית", "פנינה",
  "רייזי", "בילא", "שיינדל", "פרידה", "חוה", "מיכל",
];
const lastNames = [
  "כהן", "לוי", "גולד", "פריד", "שטרן", "ברקוביץ", "וייס", "קליין",
  "רוזן", "הלוי", "זילבר", "שוורץ", "גרין", "ברג", "אדלר", "זוסמן",
  "פרידמן", "קפלן", "הורוביץ", "שפירא", "גרוס", "פינקל", "לנדא", "אייזן",
];
const cities = ["ירושלים", "בני ברק", "אשדוד", "מודיעין עילית", "ביתר עילית", "אלעד", "חיפה"];
const schools = ["בית יעקב", "הסמינר העירוני", "אופקים", "נתיבות"];

const classesByGrade = {
  א: ["יג 1", "יג 2"],
  ב: ["יד 1", "יד 2"],
  ג: ["שנה ג"],
};
const tracks = ["הוראה", "הוראה מקוצרת", "הוראת מדעי המחשב", "ללא הוראה"];
const specs = [
  "אדריכלות",
  "גרפיקה",
  "הוראה מתקנת",
  "חינוך מיוחד",
  "חשבונאות",
  "תכנות",
  "תנך",
];

function book(title, rows, extraHelp) {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, sheet, "תלמידות");
  const help = [
    [title],
    ["חובה: שם פרטי, משפחה, מ.ז., כיתה, מסלול, התמחות. שכבה מומלצת."],
    ["שמות שכבה / כיתה / מסלול / התמחות חייבים להתאים להגדרות השנה הפעילה."],
    ["כיתות: יג 1 / יג 2 (א), יד 1 / יד 2 (ב), שנה ג (ג)."],
    ["מסלולים: הוראה, הוראה מקוצרת, הוראת מדעי המחשב, ללא הוראה."],
    ["התמחויות: אדריכלות, גרפיקה, הוראה מתקנת, חינוך מיוחד, חשבונאות, תכנות, תנך."],
    ["תוכנית חץ / פסיכולוגיה: כן או לא."],
    [extraHelp],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(help);
  helpSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, helpSheet, "הנחיות");
  return wb;
}

function nameParts(i) {
  const first = firstNames[i % firstNames.length];
  const last = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
  const suffix = i >= firstNames.length * lastNames.length ? String(i) : "";
  return { first, last: suffix ? `${last}${suffix}` : last };
}

function padId(n) {
  return String(n).padStart(9, "0");
}

function birthGregorian(i) {
  const y = 2004 + (i % 4);
  const m = String((i % 12) + 1).padStart(2, "0");
  const d = String((i % 27) + 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeRows({ count, idStart, grades, date, cohortByGrade }) {
  const rows = [];
  const gradeCounts = Object.fromEntries(grades.map((g) => [g, 0]));
  for (let i = 0; i < count; i++) {
    const grade = grades[i % grades.length];
    const classOptions = classesByGrade[grade];
    const className = classOptions[gradeCounts[grade] % classOptions.length];
    gradeCounts[grade] += 1;
    const track = tracks[i % tracks.length];
    const spec = specs[i % specs.length];
    let secondary = "";
    if (i % 8 === 0) secondary = specs[(i + 1) % specs.length];
    const psychology = i % 12 === 0 ? "כן" : "לא";
    const chetz = i % 6 === 0 ? "כן" : "לא";
    const { first, last } = nameParts(i + (idStart % 1000));
    const city = cities[i % cities.length];
    const n = i + 1;
    rows.push([
      i % 5 === 0 ? "א" : "",
      first,
      last,
      className,
      padId(idStart + i),
      "ט״ו בשבט תשס״ה",
      birthGregorian(i),
      `רחוב הדקל ${n}`,
      city,
      `02-5${String(100 + (n % 800)).padStart(3, "0")}${String(n).padStart(2, "0")}`,
      `050-7${String(1000 + n).slice(-4)}`,
      `052-8${String(1000 + n).slice(-4)}`,
      `058-9${String(1000 + n).slice(-4)}`,
      schools[i % schools.length],
      chetz,
      grade,
      track,
      spec,
      psychology,
      secondary,
      cohortByGrade[grade],
      date,
    ]);
  }
  return rows;
}

const file1 = makeRows({
  count: 100,
  idStart: 100000001,
  grades: ["א", "ב", "ג"],
  date: "2026-09-01",
  cohortByGrade: { א: 5, ב: 4, ג: 3 },
});
const file2 = makeRows({
  count: 35,
  idStart: 200000001,
  grades: ["א"],
  date: "2027-09-01",
  cohortByGrade: { א: 6 },
});

const outDir = __dirname;
const keep = new Set([
  "generate-demo-students.js",
  "01-100-students-3-grades.xlsx",
  "02-35-students-grade-alef.xlsx",
]);
for (const name of fs.readdirSync(outDir)) {
  if (!keep.has(name) && !name.startsWith("~$")) {
    try {
      fs.unlinkSync(path.join(outDir, name));
    } catch {
      console.warn("לא נמחק (קובץ פתוח?):", name);
    }
  }
}

XLSX.writeFile(
  book(
    "קובץ 1: 100 תלמידות לשלוש שכבות (כל השדות החדשים)",
    file1,
    "העלי בשנה הנוכחית. מתאים לבדיקה כללית / ייבוא מלא."
  ),
  path.join(outDir, "01-100-students-3-grades.xlsx")
);
XLSX.writeFile(
  book(
    "קובץ 2: 35 תלמידות חדשות לשכבה א (אחרי קידום)",
    file2,
    "אחרי קידום שנה — העלי רק את הקובץ הזה לשכבה א. הת.ז. לא חופפות לקובץ 1."
  ),
  path.join(outDir, "02-35-students-grade-alef.xlsx")
);
console.log("file1", file1.length, "file2", file2.length);
console.log("sample", file1[0]);
