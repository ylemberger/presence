# AGENTS.md — כללי פיתוח למערכת נוכחות סמינר

## עקרונות ליבה (אסור לשבור)

1. **תלמידות (`students`)** — ישות קבועה. לעולם לא למחוק פיזית. רק `is_active = false`.
2. **היסטוריה (`student_assignments`)** — כל שיבוץ עם `start_date`/`end_date`. העברה/קידום = סגירת שיבוץ ישן (יום לפני) + פתיחת חדש. כיתה/מסלול/התמחות תמיד לפי השיבוץ של השנה שנבחרה.
3. **שנים אקדמיות** — עצמאיות. החלפת שנה פעילה (`is_active`) לא משנה נתונים היסטוריים.
4. **קידום שנה** — א→ב (כיתה יג→יד), ב→ג (כולן לכיתה `שנה ג`), ג→ארכיון. פירוט: [`.cursor/rules/year-promotion.mdc`](.cursor/rules/year-promotion.mdc).
5. **שיעורים** — `lessons` = תבנית, `lesson_occurrences` = מופע. ביטול רק ברמת מופע.
6. **סנכרון מורות** — ממערכת השכר **קריאה בלבד** (ראי [`.cursor/rules/salary-system-read-only.mdc`](.cursor/rules/salary-system-read-only.mdc)). כתיבה רק ל-`teachers` / `teacher_source_records` בנוכחות. לא לדרוס `teachers.is_local = true` או שדות מקומיים.
   **כל שנה מחדש מהשכר** — לא מעתיקים מורות/שיבוצי שכר/שיבוצי הוראה מהשנה שעברה. קידום שנה מקדם רק תלמידות.

## מסד נתונים

- **סכימה מלאה:** [`supabase/setup_database.sql`](supabase/setup_database.sql) — קובץ יחיד לפרויקט חדש.
- **שינוי סכימה:** עדכן את `setup_database.sql` + הוסף patch ב-`supabase/patches/` למסד קיים (ראי [`supabase/README.md`](supabase/README.md)).
- **RLS:** כל הטבלאות — רק מי שב-`app_access_emails`. אין גישה לאנונימי. מייל מ-JWT בלבד.
- **טריגרים קיימים:** ביקורת נוכחות, מניעת חפיפת שיבוצים, שנה פעילה יחידה.
- **מחיקה:** ב-UI — בדיקת הפניות לפני מחיקה. CASCADE רק לפעולות על-שנה.

## נוכחות

- סטטוסים: `present` / `absent` / `late` (עברית: נוכחת / נעדרה / איחור).
- **איחור:** כל שני איחורים = חיסור אחד. איחור בודד שנשאר בסוף נספר כנוכחות.
- **יחידת חישוב:** כל שיעור לבד, אלא אם קיבוץ ידני ב-`attendance_pools` (רק אותה קבוצה — לא לפי שם מקצוע).
- **משך:** `period_count` הוא מספר מפגשי נוכחות נפרדים באותו יום, שעה אחרי שעה. שעה 3 למשך 3 = מפגשים בשעות 3, 4 ו־5, לא מפגש אחד. «אחרי צהריים» תמיד מפגש אחד. פירוט: [`.cursor/rules/lesson-hour-meetings.mdc`](.cursor/rules/lesson-hour-meetings.mdc).
- **עריכת שיעור עם נוכחות:** מותר לערוך שם, מורה, כלל נוכחות וטווח. קהל יעד, יום, שעה, משך ותדירות נעולים כל עוד יש סימון. טווח חדש חייב לכלול כל מפגש שסומן. העריכה לא מוחקת סימונים. איפוס מפורש («אפסי מפגש זה» / «אפסי נוכחות של כל המפגשים») מוחק סימונים בלי למחוק את השיעור. פירוט: [`.cursor/rules/lesson-edit-with-attendance.mdc`](.cursor/rules/lesson-edit-with-attendance.mdc).
- **שיוך לשיעור אחר:** מותר לשייך תלמידה לשיעור שאינו של הכיתה או ההתמחות שלה, אחרי אזהרה ו«שמרי בכל זאת». שיוך חופף לאותו שיעור לא נשמר שוב. שורת שיוך ידני ניתנת להסרה בלי למחוק את התלמידה או את הנוכחות. שיוך ידני לא נסגר בהעברה. שגיאות שיוך והעברה בעברית. פירוט: [`.cursor/rules/manual-lesson-assignment.mdc`](.cursor/rules/manual-lesson-assignment.mdc).
- **סימון:** אי אפשר להתחיל מופע אם לשיעור יש מופע בשבוע הקודם שלא מולא במלואו.
- מכנה: מופעים `scheduled`/`completed` (לא `cancelled`) בתוקף שיבוץ + שיוך שיעור.
- כל שינוי נרשם ב-`attendance_change_log` (טריגר DB).

## קוד

- ממשק: **עברית + RTL** (`dir="rtl"`, `lang="he"`).
- Server Actions ב-`src/app/(dashboard)/actions.ts` לכתיבה.
- טיפוסים ב-`src/types/database.ts` — עדכן יחד עם מיגרציה.
- רכיבי UI משותפים ב-`src/components/ui/`.
- **יציבות UI:** שינוי עיצוב/חלון לא ישבור זרימות קיימות (יצירה/עריכה/סגירה). פירוט: [`.cursor/rules/ui-stability.mdc`](.cursor/rules/ui-stability.mdc).

## לפני שינוי

1. האם זה משפיע על נתונים היסטוריים? אם כן — אל תדרוס, הוסף רשומה חדשה.
2. האם נדרש שינוי סכימה? אם כן — עדכן `setup_database.sql` + patch ב-`supabase/patches/`, ואל תערוך ידנית טבלאות בפרודקשן.
3. האם יש RLS/policy? שמור על `app_access_emails` + JWT email בלבד. אין גישה לאנונימי.

## פריסה

- `.env.local` (נוכחות): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `.env.local` (שכר, קריאה בלבד): `SALARY_SUPABASE_URL`, `SALARY_SUPABASE_ANON_KEY` — מ-Supabase של השכר → Settings → API (anon, בלי `NEXT_PUBLIC_`).
- הרץ `setup_database.sql` ב-Supabase SQL Editor לפני שימוש ראשון.
