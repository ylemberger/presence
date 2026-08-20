-- Teaching assignments: חובה/התמחות like lessons (class OR track OR specialization)

alter table teacher_teaching_assignments
  add column if not exists track_id uuid references tracks(id);

alter table teacher_teaching_assignments
  add column if not exists billing_type text;

-- Backfill existing rows as mandatory with class
update teacher_teaching_assignments
set billing_type = case
  when specialization_id is not null and class_id is null then 'specialization'
  else 'mandatory'
end
where billing_type is null;

-- Specialization rows: clear class/track
update teacher_teaching_assignments
set class_id = null, track_id = null
where billing_type = 'specialization';

-- Mandatory rows: clear specialization
update teacher_teaching_assignments
set specialization_id = null
where billing_type = 'mandatory';

-- Rows that still can't satisfy the rule: keep class if present, else delete orphan
delete from teacher_teaching_assignments
where billing_type = 'mandatory'
  and class_id is null
  and track_id is null;

delete from teacher_teaching_assignments
where billing_type = 'specialization'
  and specialization_id is null;

alter table teacher_teaching_assignments
  alter column billing_type set not null;

alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_billing_type_check;

alter table teacher_teaching_assignments
  add constraint teacher_teaching_assignments_billing_type_check
  check (billing_type in ('mandatory', 'specialization'));

alter table teacher_teaching_assignments
  drop constraint if exists teacher_teaching_assignments_scope_check;

alter table teacher_teaching_assignments
  add constraint teacher_teaching_assignments_scope_check check (
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

create index if not exists idx_tta_track on teacher_teaching_assignments (track_id);
create index if not exists idx_tta_billing on teacher_teaching_assignments (billing_type);
