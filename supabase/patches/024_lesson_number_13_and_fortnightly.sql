-- Raise daily period numbers to 1–13, and allow fortnightly lessons (every 2 weeks).
-- Additive only: no deletes of lessons, occurrences, or attendance.
-- Safe to re-run.

-- ========== periods 1–13 on lessons ==========
alter table lessons drop constraint if exists lessons_lesson_number_check;
alter table lessons add constraint lessons_lesson_number_check
  check (lesson_number between 1 and 13);

alter table lessons drop constraint if exists lessons_period_count_check;
alter table lessons add constraint lessons_period_count_check
  check (period_count between 1 and 13);

alter table lessons drop constraint if exists lessons_period_span_check;
alter table lessons add constraint lessons_period_span_check
  check (lesson_number + period_count - 1 between 1 and 13);

-- ========== same bounds on weekly slots (if table exists) ==========
do $$
begin
  if to_regclass('public.lesson_weekly_slots') is not null then
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_lesson_number_check;
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_period_count_check;
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_period_span_check;

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_lesson_number_check
      check (lesson_number between 1 and 13);

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_period_count_check
      check (period_count between 1 and 13);

    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_period_span_check
      check (lesson_number + period_count - 1 between 1 and 13);
  end if;
end $$;

-- ========== fortnightly cadence (default = every week) ==========
alter table lessons
  add column if not exists repeat_every_weeks smallint not null default 1;

alter table lessons
  drop constraint if exists lessons_repeat_every_weeks_check;

alter table lessons
  add constraint lessons_repeat_every_weeks_check
  check (repeat_every_weeks in (1, 2));

comment on column lessons.repeat_every_weeks is
  '1 = every week, 2 = every other week (from first matching date in activity range)';

notify pgrst, 'reload schema';

select '024 lesson periods 13 and fortnightly ok' as status;
