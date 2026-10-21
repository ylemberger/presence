-- Afternoon slot: lesson_number 14, always one block, sorts after hours 1–13.
-- Does not delete lessons, occurrences, or attendance.
-- Safe to re-run. Numbered spans still cannot spill into 14.

alter table lessons drop constraint if exists lessons_lesson_number_check;
alter table lessons add constraint lessons_lesson_number_check
  check (lesson_number between 1 and 14);

alter table lessons drop constraint if exists lessons_period_count_check;
alter table lessons add constraint lessons_period_count_check
  check (period_count between 1 and 13);

alter table lessons drop constraint if exists lessons_period_span_check;
alter table lessons add constraint lessons_period_span_check
  check (
    (lesson_number between 1 and 13 and lesson_number + period_count - 1 between 1 and 13)
    or (lesson_number = 14 and period_count = 1)
  );

do $$
begin
  if to_regclass('public.lesson_weekly_slots') is not null then
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_lesson_number_check;
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_period_count_check;
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_period_span_check;

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_lesson_number_check
      check (lesson_number between 1 and 14);

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_period_count_check
      check (period_count between 1 and 13);

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_period_span_check
      check (
        (lesson_number between 1 and 13 and lesson_number + period_count - 1 between 1 and 13)
        or (lesson_number = 14 and period_count = 1)
      );
  end if;
end $$;

comment on column lessons.lesson_number is
  '1–13 numbered period. 14 = afternoon (אחרי צהריים): always last, period_count must be 1.';

notify pgrst, 'reload schema';

select '029 afternoon lesson ok' as status;
