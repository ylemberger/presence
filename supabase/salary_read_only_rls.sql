-- הרצה ב-Supabase SQL Editor של **מערכת השכר בלבד** (לא פרויקט הנוכחות).
-- מטרה: anon יכול רק לקרוא salary_records. אין כתיבה/מחיקה/עדכון.
-- בטוח להרצה חוזרת.
-- אם מופיעה הודעה שהטבלה חסרה — זה הפרויקט הלא נכון (נוכחות במקום שכר).

do $$
begin
  if to_regclass('public.salary_records') is null then
    raise exception 'salary_records לא קיימת כאן. זה לא פרויקט השכר — אל תריצי את הסקריפט במסד הנוכחות.';
  end if;
end $$;

alter table salary_records enable row level security;

drop policy if exists salary_records_anon_select on salary_records;
create policy salary_records_anon_select
  on salary_records
  for select
  to anon
  using (true);

drop policy if exists salary_records_anon_insert on salary_records;
drop policy if exists salary_records_anon_update on salary_records;
drop policy if exists salary_records_anon_delete on salary_records;

revoke insert, update, delete on table salary_records from anon;
grant select on table salary_records to anon;

select 'salary_records anon is select-only' as status;
