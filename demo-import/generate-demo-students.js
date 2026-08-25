/* eslint-disable */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const headers = [
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
];

const firstNames = [
  "רחל", "שרה", "מרים", "חנה", "רבקה", "לאה", "אסתר", "דינה",
  "יעל", "תמר", "נעמי", "ברכה", "פייגי", "מלכה", "רותי", "גיטי",
  "ציפורה", "גולדה", "בתיה", "שולמית", "הדסה", "אסנת", "יהודית", "פנינה",
];
const lastNames = [
  "כהן", "לוי", "גולד", "פריד", "שטרן", "ברקוביץ", "וייס", "קליין",
  "רוזן", "הלוי", "זילבר", "שוורץ", "גרין", "ברג", "אדלר", "זוסמן",
  "פרידמן", "קפלן", "הורוביץ", "שפירא", "גרוס", "פינקל", "לנדא", "אייזן",
];

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
  sheet["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, sheet, "תלמידות");
  const help = [
    [title],
    ["חובה למלא את כל העמודות מלבד התמחות נוספת."],
    ["שמות שכבה / כיתה / מסלול / התמחות חייבים להתאים להגדרות השנה הפעילה."],
    ["כיתות: יג 1 / יג 2 (א), יד 1 / יד 2 (ב), שנה ג (ג)."],
    ["מסלולים: הוראה, הוראה מקוצרת, הוראת מדעי המחשב, ללא הוראה."],
    ["התמחויות: אדריכלות, גרפיקה, הוראה מתקנת, חינוך מיוחד, חשבונאות, תכנות, תנך."],
    [extraHelp],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(help);
  helpSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, helpSheet, "הנחיות");
  return wb;
}

function nameAt(i) {
  const first = firstNames[i % firstNames.length];
  const last = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
  const suffix = i >= firstNames.length * lastNames.length ? ` ${i}` : "";
  return `${first} ${last}${suffix}`;
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
    if (i % 8 === 0) {
      secondary = specs[(i + 1) % specs.length];
    }
    const psychology = i % 12 === 0 ? "כן" : "לא";
    const id = String(idStart + i);
    rows.push([
      nameAt(i + (idStart % 1000)),
      id,
      cohortByGrade[grade],
      grade,
      className,
      track,
      spec,
      secondary,
      psychology,
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

const outDir = path.join(__dirname);
const keep = new Set([
  "generate-demo-students.js",
  "01-100-students-3-grades.xlsx",
  "02-35-students-grade-alef.xlsx",
]);
for (const name of fs.readdirSync(outDir)) {
  if (!keep.has(name)) {
    try {
      fs.unlinkSync(path.join(outDir, name));
    } catch {
      console.warn("לא נמחק (קובץ פתוח?):", name);
    }
  }
}

XLSX.writeFile(
  book("קובץ 1: 100 תלמידות לשלוש שכבות", file1, "העלי בשנה הנוכחית לפני קידום שנה."),
  path.join(outDir, "01-100-students-3-grades.xlsx")
);
XLSX.writeFile(
  book("קובץ 2: 35 תלמידות חדשות לשכבה א", file2, "אחרי קידום שנה — העלי רק את הקובץ הזה. הת.ז. לא חופפות לקובץ 1."),
  path.join(outDir, "02-35-students-grade-alef.xlsx")
);
console.log("file1", file1.length, "file2", file2.length);
console.log("sample file1", file1[0]);
console.log("sample file2", file2[0]);
