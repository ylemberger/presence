-- A note for every lesson on one calendar day and one lesson hour.
-- The per-occurrence note stays. Nothing is deleted. Safe to re-run.

alter table attendance_notes
  add column if not exists slot_date date,
  add column if not exists slot_lesson_number smallint;

alter table attendance_notes drop constraint if exists attendance_notes_one_target;

alter table attendance_notes
  add constraint attendance_notes_one_target check (
    (student_id is not null and lesson_id is null and lesson_occurrence_id is null and slot_date is null and slot_lesson_number is null)
    or (lesson_id is not null and student_id is null and lesson_occurrence_id is null and slot_date is null and slot_lesson_number is null)
    or (lesson_occurrence_id is not null and student_id is null and lesson_id is null and slot_date is null and slot_lesson_number is null)
    or (
      slot_date is not null
      and slot_lesson_number between 1 and 19
      and student_id is null
      and lesson_id is null
      and lesson_occurrence_id is null
    )
  );

create unique index if not exists idx_attendance_notes_slot
  on attendance_notes (academic_year_id, slot_date, slot_lesson_number)
  where slot_date is not null and slot_lesson_number is not null;

comment on column attendance_notes.slot_date is
  'Shared note for every lesson on this date and lesson hour. Separate from the occurrence note.';

notify pgrst, 'reload schema';

select '035 slot notes ok' as status;
