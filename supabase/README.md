# מסד נתונים (Supabase)

**שני קבצים בלבד לשימוש יומיומי:**

| קובץ | מתי להריץ |
|------|-----------|
| [`setup_database.sql`](setup_database.sql) | **פרויקט Supabase חדש** — פעם אחת. |
| [`RUN_ME.sql`](RUN_ME.sql) | **מסד קיים** — פעם אחת (או אחרי עדכון סכימה). כולל את כל השינויים החסרים + שדות תלמידה מורחבים. בטוח להרצה חוזרת. |

ריקון כל הנתונים (אופציונלי): [`reset_all_data.sql`](reset_all_data.sql).

### מה להריץ עכשיו (מסד קיים)

1. פתחי **Supabase → SQL Editor**.
2. הדביקי והריצי את כל [`RUN_ME.sql`](RUN_ME.sql).
3. אם רוצות למחוק רק תלמידות לפני ייבוא מחדש — בתוך `RUN_ME.sql` יש 3 שורות `delete` בהערה בראש הקובץ; הסירי את `--` והריצי שוב רק את החלק הזה (או את כל הקובץ).
4. רענני את האפליקציה.

### למה לא 1000 קבצי patch?

תיקיית `patches/` היא ארכיון היסטורי למתכנתים. **אין צורך להריץ אותם אחד־אחד** — `RUN_ME.sql` מאגד את מה שצריך למסד קיים, ו־`setup_database.sql` הוא המקור לפרויקט חדש.

### לוגיקת תלמידות (אל תשברו)

| באקסל / במסך | איפה במסד |
|---------------|-----------|
| מי, שם פרטי, משפחה, מ.ז., ת.ל., כתובת, עיר, טלפונים, תיכון, תוכנית חץ | `students` (קבוע) |
| כיתה, מסלול, התמחות, פסיכולוגיה, התמחות נוספת | `student_assignments` **לפי שנה** (היסטוריה) |

`full_name` נשמר לחיפוש/תצוגה = שם פרטי + משפחה.

## טבלאות עיקריות

- **שנה:** `academic_years`, `grades`, `classes`, `tracks`, `specializations`, `activity_ranges`, `holiday_periods`
- **תלמידות:** `students`, `student_assignments`, `student_lesson_assignments`
- **מורות:** `teachers`, `teacher_teaching_assignments`, `teacher_source_records`
- **שיעורים:** `lessons`, `lesson_audience`, `lesson_occurrences`
- **נוכחות:** `attendance`, `attendance_change_log`, `attendance_rules`, `attendance_notes`, `makeup_exams`
