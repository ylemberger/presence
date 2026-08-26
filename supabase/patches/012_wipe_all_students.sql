-- מחיקת כל התלמידות מכל השנים (cascade: שיבוצים, נוכחות, שיוך לשיעורים, הערות…).
-- לא נוגע בשנים / כיתות / מסלולים / מורות / שיעורים.
-- הריצי ב-Supabase SQL Editor.

delete from students;

select 'all students deleted' as status;
