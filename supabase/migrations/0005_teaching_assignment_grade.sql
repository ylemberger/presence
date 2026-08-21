-- Teaching assignments: grade scope + clarify class∩track matching in app

alter table teacher_teaching_assignments
  add column if not exists grade_id uuid references grades(id);

-- Backfill grade from linked class when possible
update teacher_teaching_assignments tta
set grade_id = c.grade_id
from classes c
where tta.class_id = c.id
  and tta.grade_id is null;

create index if not exists idx_tta_grade on teacher_teaching_assignments (grade_id);
