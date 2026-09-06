-- ניקוי נתוני ניסוי בלבד.
-- מוחק: כל התלמידות + כל השיעורים (ומה שתלוי בהם: נוכחות, מופעים, שיוכים, קיבוצי נוכחות).
-- לא מוחק: שנים, שכבות, כיתות, מסלולים, התמחויות, מורות, שיבוצי שכר,
--          כללי נוכחות, טווחי פעילות, חופשות, טבלת מקצועות (רק שמות ריקים).
-- בטוח להרצה חוזרת. הריצי ב-Supabase SQL Editor של פרויקט הנוכחות בלבד.

begin;

-- תלמידות. CASCADE מוחק איתן:
-- student_assignments, student_lesson_assignments, attendance,
-- attendance_change_log (דרך attendance), makeup_exams, הערות מקושרות לתלמידה.
delete from students;

-- שיעורים. CASCADE מוחק איתם:
-- lesson_occurrences, lesson_audience, שיוכי תלמידה שנשארו,
-- נוכחות שנשארה על מופעים, חברי קיבוץ נוכחות, מבחני השלמה לפי שיעור, הערות לשיעור.
delete from lessons;

-- שמות קיבוץ נוכחות ריקים שנשארו אחרי מחיקת השיעורים.
-- אם 015 עוד לא הורץ — מדלגים בלי שגיאה.
do $$
begin
  if to_regclass('public.attendance_pools') is not null then
    delete from attendance_pools;
  end if;
end $$;

commit;

select 'wiped experimental students and lessons' as status;
