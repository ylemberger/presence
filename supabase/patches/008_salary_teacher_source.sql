-- Imported salary-job fields (names prefixed so they are not confused with local tracks/years).
-- Sync only INSERTs; never deletes teachers or source rows.

alter table teacher_source_records
  add column if not exists teacher_id uuid references teachers(id) on delete restrict;

alter table teacher_source_records
  add column if not exists salary_subject text;

alter table teacher_source_records
  add column if not exists salary_track text;

alter table teacher_source_records
  add column if not exists salary_grade_year text;

alter table teacher_source_records
  add column if not exists salary_semester text;

alter table teacher_source_records
  add column if not exists salary_meetings integer;

create index if not exists idx_teacher_source_records_teacher
  on teacher_source_records (teacher_id);

-- Presence project only (never the salary database).
notify pgrst, 'reload schema';
