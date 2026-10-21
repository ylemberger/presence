-- A lesson note belongs to one occurrence (one meeting), not every meeting of the subject.
-- Existing student notes and old lesson-wide notes stay. Nothing is deleted.
-- Safe to re-run.

alter table attendance_notes
  add column if not exists lesson_occurrence_id uuid references lesson_occurrences(id) on delete cascade;

alter table attendance_notes drop constraint if exists attendance_notes_one_target;
alter table attendance_notes drop constraint if exists attendance_notes_check;

alter table attendance_notes
  add constraint attendance_notes_one_target check (
    (student_id is not null and lesson_id is null and lesson_occurrence_id is null)
    or (lesson_id is not null and student_id is null and lesson_occurrence_id is null)
    or (lesson_occurrence_id is not null and student_id is null and lesson_id is null)
  );

create unique index if not exists idx_attendance_notes_occurrence
  on attendance_notes (lesson_occurrence_id)
  where lesson_occurrence_id is not null;

comment on column attendance_notes.lesson_occurrence_id is
  'Note for this meeting only. Not shared with other occurrences of the same lesson.';

notify pgrst, 'reload schema';

select '030 occurrence notes ok' as status;
