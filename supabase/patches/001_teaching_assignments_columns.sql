-- הריצי ב-Supabase SQL Editor אם קיבלת שגיאה על grade_id / billing_type / for_psychology
-- בטבלת teacher_teaching_assignments (מסד ישן שלא עודכן).

alter table teacher_teaching_assignments
  add column if not exists track_id uuid references tracks(id);

alter table teacher_teaching_assignments
  add column if not exists billing_type text;

alter table teacher_teaching_assignments
  add column if not exists grade_id uuid references grades(id);

alter table teacher_teaching_assignments
  add column if not exists for_psychology boolean default false;

-- backfill
update teacher_teaching_assignments
set billing_type = case
  when specialization_id is not null and class_id is null then 'specialization'
  else 'mandatory'
end
where billing_type is null;

update teacher_teaching_assignments tta
set grade_id = c.grade_id
from classes c
where tta.class_id = c.id
  and tta.grade_id is null;

update teacher_teaching_assignments set for_psychology = false where for_psychology is null;

-- constraints (מחליף גרסאות ישנות)
alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_billing_type_check;
alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_scope_check;
alter table teacher_teaching_assignments
  drop constraint if exists tta_billing_scope_check;

alter table teacher_teaching_assignments
  add constraint teacher_teaching_assignments_billing_type_check
  check (billing_type in ('mandatory', 'specialization'));

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

create index if not exists idx_tta_track on teacher_teaching_assignments (track_id);
create index if not exists idx_tta_billing on teacher_teaching_assignments (billing_type);
create index if not exists idx_tta_grade on teacher_teaching_assignments (grade_id);

-- lessons: for_psychology (אם חסר)
alter table lessons
  add column if not exists for_psychology boolean default false;

update lessons set for_psychology = false where for_psychology is null;

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

-- students / assignments (אם חסר)
alter table students
  add column if not exists cohort_number integer default 1;

alter table student_assignments
  add column if not exists secondary_specialization_id uuid references specializations(id),
  add column if not exists is_psychology boolean default false;

update student_assignments set is_psychology = false where is_psychology is null;

notify pgrst, 'reload schema';
