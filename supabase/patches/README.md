# Patches — שינויי סכימה למסד קיים

כשיש כבר מסד נתונים בפרודקשן, **אל** תריצי שוב את `setup_database.sql`.

צרי כאן קובץ SQL חדש עם **רק** השינוי (ALTER TABLE, CREATE INDEX וכו'), והריצי אותו ב-Supabase SQL Editor.

דוגמה לשם קובץ: `001_add_notes_column.sql`

זכרי לעדכן גם את `setup_database.sql` (לפרויקטים חדשים) ואת `src/types/database.ts`.
