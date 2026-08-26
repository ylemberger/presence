# מסד נתונים (Supabase)

**שני קבצים בלבד לשימוש יומיומי:**

| קובץ | מתי להריץ |
|------|-----------|
| [`setup_database.sql`](setup_database.sql) | **פרויקט Supabase חדש** — פעם אחת. |
| [`RUN_ME.sql`](RUN_ME.sql) | **מסד קיים** — פעם אחת (או אחרי עדכון סכימה). כולל את כל השינויים החסרים + שדות תלמידה מורחבים. בטוח להרצה חוזרת. |

ריקון כל הנתונים (אופציונלי): [`reset_all_data.sql`](reset_all_data.sql).

### מה להריץ עכשיו (מסד קיים)

| מצב | מה להריץ |
|-----|----------|
| **רק שדות תלמידה חדשים** | [`patches/010_student_roster_fields.sql`](patches/010_student_roster_fields.sql) |
| **מחיקת כל התלמידות** (בלי seed) | [`patches/012_wipe_all_students.sql`](patches/012_wipe_all_students.sql) |
| **מחיקה + 35 לבדיקת קידום** | [`patches/011_wipe_and_seed_35_promo_test.sql`](patches/011_wipe_and_seed_35_promo_test.sql) |
| **לא בטוחה מה חסר** | כל [`RUN_ME.sql`](RUN_ME.sql) |

קבצי אקסל לדמו (אחרי שיש קטלוג כמו בהנחיות): `demo-import/01-100-students-3-grades.xlsx`, `demo-import/02-35-students-grade-alef.xlsx`.

1. פתחי **Supabase → SQL Editor**.
2. הדביקי והריצי.
3. רענני את האפליקציה.

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
