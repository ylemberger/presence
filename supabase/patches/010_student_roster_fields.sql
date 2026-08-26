-- רק מה שחסר עכשיו: שדות כרטסת תלמידה מורחבת.
-- בטוח להרצה חוזרת (add column if not exists).
-- אם כבר הרצת 009 — personal_note כבר קיים; השורה לא תזיק.

alter table students add column if not exists mi text;
alter table students add column if not exists first_name text;
alter table students add column if not exists last_name text;
alter table students add column if not exists birth_date date;
alter table students add column if not exists birth_date_hebrew text;
alter table students add column if not exists address text;
alter table students add column if not exists city text;
alter table students add column if not exists phone text;
alter table students add column if not exists father_phone text;
alter table students add column if not exists mother_phone text;
alter table students add column if not exists student_phone text;
alter table students add column if not exists high_school text;
alter table students add column if not exists chetz_program boolean;
alter table students add column if not exists personal_note text;

update students set chetz_program = false where chetz_program is null;
alter table students
  alter column chetz_program set default false,
  alter column chetz_program set not null;

-- פיצול שם מלא קיים לשם פרטי + משפחה
update students
set
  first_name = coalesce(
    nullif(trim(first_name), ''),
    nullif(split_part(trim(full_name), ' ', 1), ''),
    trim(full_name)
  ),
  last_name = coalesce(
    nullif(trim(last_name), ''),
    nullif(trim(substring(trim(full_name) from position(' ' in trim(full_name) || ' ') + 1)), ''),
    ''
  )
where first_name is null or last_name is null;

alter table students alter column first_name set default '';
alter table students alter column last_name set default '';
update students set first_name = coalesce(first_name, '') where first_name is null;
update students set last_name = coalesce(last_name, '') where last_name is null;

create index if not exists idx_students_last_name on students (last_name);
create index if not exists idx_students_city on students (city);

select '010 student roster fields ok' as status;
