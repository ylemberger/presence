-- מקצוע (הורה) → שיעורים (בישול / כביסה / גיהוץ) → מופעים
-- נוכחות מחושבת לפי מקצוע, לכל תלמידה.
-- בטוח להרצה חוזרת.

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  unique (academic_year_id, name)
);

create index if not exists idx_subjects_academic_year
  on subjects (academic_year_id);

alter table subjects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subjects' and policyname = 'authenticated_select_subjects'
  ) then
    create policy "authenticated_select_subjects" on subjects for select to authenticated using (true);
    create policy "authenticated_insert_subjects" on subjects for insert to authenticated with check (true);
    create policy "authenticated_update_subjects" on subjects for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_subjects" on subjects for delete to authenticated using (true);
  end if;
end $$;

alter table lessons
  add column if not exists subject_id uuid references subjects(id);

insert into subjects (academic_year_id, name)
select distinct academic_year_id, trim(subject)
from lessons
where subject is not null and trim(subject) <> ''
on conflict (academic_year_id, name) do nothing;

update lessons l
set subject_id = s.id
from subjects s
where l.subject_id is null
  and s.academic_year_id = l.academic_year_id
  and s.name = trim(l.subject);

alter table lessons
  alter column subject_id set not null;

create index if not exists idx_lessons_subject_id on lessons (subject_id);

-- השלמות: ייחודיות לפי תלמידה + מקצוע
alter table makeup_exams
  add column if not exists subject_id uuid references subjects(id);

update makeup_exams m
set subject_id = l.subject_id
from lessons l
where m.subject_id is null
  and l.id = m.lesson_id;

delete from makeup_exams a
using makeup_exams b
where a.subject_id is not null
  and b.subject_id is not null
  and a.student_id = b.student_id
  and a.subject_id = b.subject_id
  and a.created_at < b.created_at;

delete from makeup_exams a
using makeup_exams b
where a.subject_id is not null
  and b.subject_id is not null
  and a.student_id = b.student_id
  and a.subject_id = b.subject_id
  and a.id < b.id;

delete from makeup_exams where subject_id is null;

alter table makeup_exams drop constraint if exists makeup_exams_student_id_lesson_id_key;

create unique index if not exists makeup_exams_student_subject_uidx
  on makeup_exams (student_id, subject_id);

alter table makeup_exams
  alter column subject_id set not null;

create index if not exists idx_makeup_exams_subject on makeup_exams (subject_id);

notify pgrst, 'reload schema';

select '014 subjects ok' as status;
