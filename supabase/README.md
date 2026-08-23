# מסד נתונים (Supabase)

תיקייה זו מכילה **שני קבצי SQL בלבד** — אין צורך בקבצים נוספים.

| קובץ | מתי להריץ |
|------|-----------|
| [`setup_database.sql`](setup_database.sql) | **פרויקט Supabase חדש** — פעם אחת. יוצר את כל הטבלאות, אינדקסים, טריגרים ו-RLS. |
| [`reset_all_data.sql`](reset_all_data.sql) | **ריקון נתונים** — מוחק את כל הרשומות, שומר את מבנה הטבלאות. |

## שינוי סכימה (למתכנתים)

1. עדכן את [`setup_database.sql`](setup_database.sql) — כך שפרויקט חדש יקבל את הסכימה העדכנית.
2. אם יש כבר מסד בפרודקשן — צור קובץ patch חדש ב-`supabase/patches/` (למשל `001_add_column_x.sql`) עם **רק** השינוי, והרץ אותו ב-SQL Editor.
3. עדכן [`src/types/database.ts`](../src/types/database.ts) בהתאם.

## טבלאות עיקריות

- **שנה:** `academic_years`, `grades`, `classes`, `tracks`, `specializations`, `activity_ranges`
- **תלמידות:** `students`, `student_assignments`, `student_lesson_assignments`
- **מורות:** `teachers`, `teacher_teaching_assignments`, `teacher_source_records`
- **שיעורים:** `lessons`, `lesson_occurrences`
- **נוכחות:** `attendance`, `attendance_change_log`, `attendance_rules`, `attendance_notes`, `makeup_exams`
