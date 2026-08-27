# AGENTS.md — כללי פיתוח למערכת נוכחות סמינר

## עקרונות ליבה (אסור לשבור)

1. **תלמידות (`students`)** — ישות קבועה. לעולם לא למחוק פיזית. רק `is_active = false`.
2. **היסטוריה (`student_assignments`)** — כל שיבוץ עם `start_date`/`end_date`. העברה/קידום = סגירת שיבוץ ישן (יום לפני) + פתיחת חדש. כיתה/מסלול/התמחות תמיד לפי השיבוץ של השנה שנבחרה.
3. **שנים אקדמיות** — עצמאיות. החלפת שנה פעילה (`is_active`) לא משנה נתונים היסטוריים.
4. **קידום שנה** — א→ב (כיתה יג→יד), ב→ג (כולן לכיתה `שנה ג`), ג→ארכיון. פירוט: [`.cursor/rules/year-promotion.mdc`](.cursor/rules/year-promotion.mdc).
5. **שיעורים** — `lessons` = תבנית, `lesson_occurrences` = מופע. ביטול רק ברמת מופע.
6. **סנכרון מורות** — ממערכת השכר **קריאה בלבד** בלבד (ראי [`.cursor/rules/salary-system-read-only.mdc`](.cursor/rules/salary-system-read-only.mdc)). כתיבה רק ל-`teachers` / `teacher_source_records` בנוכחות. לא לדרוס `teachers.is_local = true` או שדות מקומיים.

## מסד נתונים

- **סכימה מלאה:** [`supabase/setup_database.sql`](supabase/setup_database.sql) — קובץ יחיד לפרויקט חדש.
- **שינוי סכימה:** עדכן את `setup_database.sql` + הוסף patch ב-`supabase/patches/` למסד קיים (ראי [`supabase/README.md`](supabase/README.md)).
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
2. האם נדרש שינוי סכימה? אם כן — עדכן `setup_database.sql` + patch ב-`supabase/patches/`, ואל תערוך ידנית טבלאות בפרודקשן.
3. האם יש RLS/policy? שמור על authenticated-only.

## פריסה

- `.env.local` (נוכחות): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `.env.local` (שכר, קריאה בלבד): `SALARY_SUPABASE_URL`, `SALARY_SUPABASE_ANON_KEY` — מ-Supabase של השכר → Settings → API (anon, בלי `NEXT_PUBLIC_`).
- הרץ `setup_database.sql` ב-Supabase SQL Editor לפני שימוש ראשון.
