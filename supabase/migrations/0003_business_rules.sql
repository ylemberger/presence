-- Business rules: required FKs, billing logic, attendance rule mandatory

-- Normalize existing lesson billing scopes before enforcing check
update lessons
set class_id = null, track_id = null
where billing_type = 'specialization'
  and specialization_id is not null;

update lessons
set specialization_id = null
where billing_type = 'mandatory';

-- Ensure every lesson has an attendance rule
update lessons
set attendance_rule_id = (
  select id from attendance_rules order by name limit 1
)
where attendance_rule_id is null
  and exists (select 1 from attendance_rules);

delete from lessons
where attendance_rule_id is null;

alter table lessons
  drop constraint if exists lessons_attendance_rule_id_fkey;

alter table lessons
  add constraint lessons_attendance_rule_id_fkey
  foreign key (attendance_rule_id) references attendance_rules(id);

alter table lessons
  alter column attendance_rule_id set not null;

alter table lessons
  drop constraint if exists lessons_billing_scope_check;

alter table lessons
  add constraint lessons_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
      and (class_id is not null or track_id is not null)
    )
  );

-- Teachers: fill blanks/short values then require contact fields
update teachers
set phone = '0500000000'
where phone is null or length(trim(phone)) < 9;

update teachers
set email = coalesce(
  nullif(trim(email), ''),
  identity_number || '@local.invalid'
)
where email is null or length(trim(email)) = 0;

update teachers
set email = identity_number || '@local.invalid'
where email is not null and email !~* '^[^@]+@[^@]+\.[^@]+$';

alter table teachers
  alter column phone set not null,
  alter column email set not null;

alter table teachers
  drop constraint if exists teachers_email_format_check;

alter table teachers
  add constraint teachers_email_format_check
  check (email ~* '^[^@]+@[^@]+\.[^@]+$');

alter table teachers
  drop constraint if exists teachers_phone_not_blank_check;

alter table teachers
  add constraint teachers_phone_not_blank_check
  check (length(trim(phone)) >= 9);

create index if not exists idx_students_identity_number on students (identity_number);
create index if not exists idx_teachers_identity_number on teachers (identity_number);
create index if not exists idx_lessons_attendance_rule on lessons (attendance_rule_id);
create index if not exists idx_lessons_billing_type on lessons (billing_type);
