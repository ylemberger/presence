-- Student extras, teaching types, psychology lessons, cohorts, fixed grades א/ב/ג

create table if not exists teaching_types (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  unique (academic_year_id, name)
);

alter table teaching_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'teaching_types' and policyname = 'authenticated_select_teaching_types'
  ) then
    create policy "authenticated_select_teaching_types" on teaching_types for select to authenticated using (true);
    create policy "authenticated_insert_teaching_types" on teaching_types for insert to authenticated with check (true);
    create policy "authenticated_update_teaching_types" on teaching_types for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_teaching_types" on teaching_types for delete to authenticated using (true);
  end if;
end $$;

-- Cohort stays on the student across years
alter table students
  add column if not exists cohort_number integer;

update students set cohort_number = 1 where cohort_number is null;

alter table students
  alter column cohort_number set not null,
  alter column cohort_number set default 1;

alter table students
  drop constraint if exists students_cohort_positive;
alter table students
  add constraint students_cohort_positive check (cohort_number >= 1);

alter table teachers
  add column if not exists teaching_type_id uuid references teaching_types(id);

alter table student_assignments
  add column if not exists secondary_specialization_id uuid references specializations(id),
  add column if not exists teaching_type_id uuid references teaching_types(id),
  add column if not exists is_psychology boolean;

update student_assignments set is_psychology = false where is_psychology is null;

alter table student_assignments
  alter column is_psychology set not null,
  alter column is_psychology set default false;

alter table teacher_teaching_assignments
  add column if not exists for_psychology boolean;

update teacher_teaching_assignments set for_psychology = false where for_psychology is null;

alter table teacher_teaching_assignments
  alter column for_psychology set not null,
  alter column for_psychology set default false;

alter table lessons
  add column if not exists for_psychology boolean;

update lessons set for_psychology = false where for_psychology is null;

alter table lessons
  alter column for_psychology set not null,
  alter column for_psychology set default false;

-- Mandatory: class/track OR psychology destination
alter table lessons drop constraint if exists lessons_billing_scope_check;
alter table lessons
  add constraint lessons_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (
        for_psychology = true
        or class_id is not null
        or track_id is not null
      )
    )
  );

-- Same rule for teaching assignments (soft check via app; DB for consistency)
alter table teacher_teaching_assignments
  drop constraint if exists tta_billing_scope_check;
alter table teacher_teaching_assignments
  add constraint tta_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (
        for_psychology = true
        or class_id is not null
        or track_id is not null
      )
    )
  );

create index if not exists idx_teaching_types_year on teaching_types (academic_year_id);
create index if not exists idx_students_cohort on students (cohort_number);
create index if not exists idx_sa_secondary_spec on student_assignments (secondary_specialization_id);
create index if not exists idx_sa_teaching_type on student_assignments (teaching_type_id);
create index if not exists idx_lessons_psychology on lessons (for_psychology);

-- Ensure each existing year has grades א ב ג
insert into grades (academic_year_id, name)
select y.id, g.name
from academic_years y
cross join (values ('א'), ('ב'), ('ג')) as g(name)
where not exists (
  select 1 from grades existing
  where existing.academic_year_id = y.id and existing.name = g.name
);
