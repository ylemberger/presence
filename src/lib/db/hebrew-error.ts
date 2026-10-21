/** Maps PostgREST / Postgres errors to a short Hebrew message. Never leak SQL. */

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined;

function blob(error: DbErrorLike): string {
  if (!error) return "";
  return [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
}

export function hebrewDbError(error: DbErrorLike, fallback: string): string {
  if (!error) return fallback;
  const original = (error.message ?? "").trim();
  const geresh = (original.match(/\u05F3/g) ?? []).length;
  const hebrewLetters = (original.match(/[\u05D0-\u05EA]/g) ?? []).length;
  const looksGarbled = geresh >= 4 && geresh >= hebrewLetters;
  if (/[\u0590-\u05FF]/.test(original) && !looksGarbled) return original;
  if (looksGarbled) {
    return "לתלמידה כבר יש שיבוץ בטווח התאריכים הזה. בחרי תאריך העברה אחרי תחילת השיבוץ הנוכחי.";
  }

  const msg = blob(error);
  const code = error.code ?? "";

  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("identity") || msg.includes("national_id")) {
      return "מספר תעודת זהות כבר קיים במערכת. לא נשמר.";
    }
    if (msg.includes("email")) return "כתובת האימייל כבר קיימת במערכת. לא נשמר.";
    if (msg.includes("student_lesson")) {
      return "התלמידה כבר משויכת לשיעור הזה.";
    }
    if (msg.includes("lesson")) {
      return "כבר קיים שיעור עם אותם פרטים. לא נשמר.";
    }
    return "הרשומה כבר קיימת במערכת. לא נשמר.";
  }

  if (code === "23503" || msg.includes("foreign key")) {
    return "אי אפשר לשמור: אחד מהערכים שנבחרו כבר לא קיים (שכבה, כיתה, מסלול, מורה או כלל נוכחות).";
  }

  if (
    /lesson_occurrences/.test(msg) &&
    /lesson_number/.test(msg) &&
    (code === "PGRST204" || msg.includes("schema cache") || msg.includes("column"))
  ) {
    return "כל שעה היא מפגש נוכחות נפרד. הריצי supabase/patches/031_occurrence_per_hour.sql ואז נסי שוב. לא נשמר.";
  }

  if (code === "23502" || msg.includes("null value")) {
    return "חסר שדה חובה. מלאי את כל השדות ושמרי שוב. לא נשמר.";
  }

  if (msg.includes("invalid input syntax")) {
    if (msg.includes("uuid")) {
      return "אחד מהערכים שנבחרו לא זוהה. בחרי שוב מהרשימה. לא נשמר.";
    }
    if (msg.includes("date")) {
      return "התאריך לא תקין. בחרי תאריך מהיומן. לא נשמר.";
    }
  }

  if (msg.includes("overlap") || msg.includes("חפיפ") || msg.includes("check_student_assignment")) {
    return "לתלמידה כבר יש שיבוץ בטווח התאריכים הזה. בחרי תאריך העברה אחרי תחילת השיבוץ הנוכחי.";
  }

  if (code === "23514" || msg.includes("check constraint")) {
    if (msg.includes("period_span") || msg.includes("lesson_number") || msg.includes("period_count")) {
      return "השעה או מספר השעות הרצופות לא תקינים. שיעורים ממוספרים הם 1–13. «אחרי צהריים» היא שעה אחת בסוף היום, בלי רצף. אם השמירה של «אחרי צהריים» נכשלת — הריצי supabase/patches/029_afternoon_lesson.sql. לא נשמר.";
    }
    if (msg.includes("billing")) {
      return "סוג החיוב לא תואם לקהל היעד שנבחר. לא נשמר.";
    }
    if (msg.includes("dates")) {
      return "תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה. לא נשמר.";
    }
    return "הערכים שנבחרו לא עומדים בכללי המערכת. לא נשמר.";
  }

  if (
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("permission denied")
  ) {
    return "אין הרשאה לבצע את הפעולה הזו.";
  }

  return fallback;
}
