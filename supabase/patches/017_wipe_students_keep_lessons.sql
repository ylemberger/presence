-- מחיקת כל התלמידות בלבד. שיעורים, מורות, שנים, כיתות, מסלולים והתמחויות נשארים.
-- CASCADE מוחק איתן: שיבוצים, שיוך לשיעורים, נוכחות, יומן שינויים, מבחני השלמה, הערות תלמידה.
-- הריצי ב-Supabase SQL Editor של פרויקט הנוכחות בלבד. בטוח להרצה חוזרת.

begin;

delete from students;

commit;

select 'students wiped; lessons kept' as status;
