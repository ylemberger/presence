-- שכבות מרובות בקהל שיעור (lesson_audience.grade_id)
-- בטוח להרצה חוזרת.

alter table lesson_audience
  add column if not exists grade_id uuid references grades(id) on delete cascade;

alter table lesson_audience drop constraint if exists lesson_audience_one_target;

alter table lesson_audience
  add constraint lesson_audience_one_target check (
    (class_id is not null)::int
    + (track_id is not null)::int
    + (specialization_id is not null)::int
    + (grade_id is not null)::int = 1
  );

create unique index if not exists idx_lesson_audience_grade
  on lesson_audience (lesson_id, grade_id)
  where grade_id is not null;

select '013 lesson audience grades ok' as status;
