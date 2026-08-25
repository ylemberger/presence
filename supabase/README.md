# מסד נתונים (Supabase)

תיקייה זו מכילה **שני קבצי SQL בלבד** — אין צורך בקבצים נוספים.

| קובץ | מתי להריץ |
|------|-----------|
| [`setup_database.sql`](setup_database.sql) | **פרויקט Supabase חדש** — פעם אחת. יוצר את כל הטבלאות, אינדקסים, טריגרים ו-RLS. |
| [`reset_all_data.sql`](reset_all_data.sql) | **ריקון נתונים** — מוחק את כל הרשומות, שומר את מבנה הטבלאות. |

## שינוי סכימה (למתכנתים)

1. עדכן את [`setup_database.sql`](setup_database.sql) — כך שפרויקט חדש יקבל את הסכימה העדכנית.
2. אם יש כבר מסד בפרודקשן — צור קובץ patch חדש ב-`supabase/patches/` עם **רק** השינוי, והרץ אותו ב-SQL Editor.
3. עדכן [`src/types/database.ts`](../src/types/database.ts) בהתאם.

### Patches קיימים

| קובץ | תיאור |
|------|--------|
| [`patches/001_teaching_assignments_columns.sql`](patches/001_teaching_assignments_columns.sql) | עמודות חסרות ב-teaching assignments |
| [`patches/002_attendance_indexes.sql`](patches/002_attendance_indexes.sql) | אינדקסים לביצועי נוכחות |
| [`patches/003_attendance_reason.sql`](patches/003_attendance_reason.sql) | שדה `reason` להיעדרות |
| [`patches/004_makeup_blocked_status.sql`](patches/004_makeup_blocked_status.sql) | מאפשר `required_exams=0` לחסומות |
| [`patches/005_holiday_periods.sql`](patches/005_holiday_periods.sql) | לוח חופשות שנתי (`holiday_periods`) |

## טבלאות עיקריות

- **שנה:** `academic_years`, `grades`, `classes`, `tracks`, `specializations`, `activity_ranges`, `holiday_periods`
- **תלמידות:** `students`, `student_assignments`, `student_lesson_assignments`
- **מורות:** `teachers`, `teacher_teaching_assignments`, `teacher_source_records`
- **שיעורים:** `lessons`, `lesson_occurrences`
- **נוכחות:** `attendance`, `attendance_change_log`, `attendance_rules`, `attendance_notes`, `makeup_exams`
