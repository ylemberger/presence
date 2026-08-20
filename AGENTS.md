# AGENTS.md — כללי פיתוח למערכת נוכחות סמינר

## עקרונות ליבה (אסור לשבור)

1. **תלמידות (`students`)** — ישות קבועה. לעולם לא למחוק פיזית. רק `is_active = false`.
2. **היסטוריה (`student_assignments`)** — כל שיבוץ עם `start_date`/`end_date`. העברה = סגירת שיבוץ ישן (יום לפני) + פתיחת חדש.
3. **שנים אקדמיות** — עצמאיות. החלפת שנה פעילה (`is_active`) לא משנה נתונים היסטוריים.
4. **שיעורים** — `lessons` = תבנית, `lesson_occurrences` = מופע. ביטול רק ברמת מופע.
5. **סנכרון מורות** — `teacher_source_records` לקריאה בלבד. לא לדרוס `teachers.is_local = true` או שדות מקומיים.

## מסד נתונים

- **אל תשנה סכימה** בלי מיגרציה חדשה ב-`supabase/migrations/`.
- **RLS:** כל הטבלאות — `authenticated` בלבד. אין גישה לאנונימי.
- **טריגרים קיימים:** ביקורת נוכחות, מניעת חפיפת שיבוצים, שנה פעילה יחידה.
- **מחיקה:** ב-UI — בדיקת הפניות לפני מחיקה. CASCADE רק לפעולות על-שנה.

## נוכחות

- סטטוסים: `present` / `absent` / `late` (עברית: נוכחת / נעדרה / איחור).
- **איחור = נוכחות** לחישוב אחוז היעדרות.
- מכנה: מופעים `scheduled`/`completed` (לא `cancelled`) בתוקף שיבוץ + שיוך שיעור.
- כל שינוי נרשם ב-`attendance_change_log` (טריגר DB).

## קוד

- ממשק: **עברית + RTL** (`dir="rtl"`, `lang="he"`).
- Server Actions ב-`src/app/(dashboard)/actions.ts` לכתיבה.
- טיפוסים ב-`src/types/database.ts` — עדכן יחד עם מיגרציה.
- רכיבי UI משותפים ב-`src/components/ui/`.

## לפני שינוי

1. האם זה משפיע על נתונים היסטוריים? אם כן — אל תדרוס, הוסף רשומה חדשה.
2. האם נדרשת מיגרציה? אם כן — צור קובץ SQL חדש, אל תערוך `0001_init.sql`.
3. האם יש RLS/policy? שמור על authenticated-only.

## פריסה

- `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- הרץ מיגרציות ב-Supabase SQL Editor לפני שימוש.
