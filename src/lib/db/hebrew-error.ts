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
  if (/[\u0590-\u05FF]/.test(original)) return original;

  const msg = blob(error);
  const code = error.code ?? "";

  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("identity") || msg.includes("national_id")) {
      return "מספר תעודת זהות כבר קיים במערכת. לא נשמר.";
    }
    if (msg.includes("email")) return "כתובת האימייל כבר קיימת במערכת. לא נשמר.";
    if (msg.includes("lesson")) {
      return "כבר קיים שיעור עם אותם פרטים. לא נשמר.";
    }
    return "הרשומה כבר קיימת במערכת. לא נשמר.";
  }

  if (code === "23503" || msg.includes("foreign key")) {
    return "אי אפשר לשמור: אחד מהערכים שנבחרו כבר לא קיים (שכבה, כיתה, מסלול, מורה או כלל נוכחות).";
  }

  if (code === "23502" || msg.includes("null value")) {
    return "חסר שדה חובה. מלאי את כל השדות ושמרי שוב. לא נשמר.";
  }

  if (msg.includes("overlap") || msg.includes("חפיפ")) {
    return "לתלמידה כבר יש שיבוץ בטווח התאריכים הזה. בחרי תאריך העברה אחרי תחילת השיבוץ הנוכחי.";
  }

  if (code === "23514" || msg.includes("check constraint")) {
    if (msg.includes("period_span")) {
      return "מספר השיעור והרצף חורגים מטווח השיעורים ביום (1 עד 13). לא נשמר.";
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
