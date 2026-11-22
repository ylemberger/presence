-- Afternoon multi-hour: lesson_number 14 may have period_count 1–6.
-- Each afternoon hour is its own attendance meeting (14, 15, …).
-- Does not delete lessons, occurrences, or attendance. Safe to re-run.

alter table lessons drop constraint if exists lessons_period_span_check;
alter table lessons add constraint lessons_period_span_check
  check (
    (lesson_number between 1 and 13 and lesson_number + period_count - 1 between 1 and 13)
    or (lesson_number = 14 and period_count between 1 and 6)
  );

do $$
begin
  if to_regclass('public.lesson_weekly_slots') is not null then
    alter table lesson_weekly_slots drop constraint if exists lesson_weekly_slots_period_span_check;
    alter table lesson_weekly_slots
      add constraint lesson_weekly_slots_period_span_check
      check (
        (lesson_number between 1 and 13 and lesson_number + period_count - 1 between 1 and 13)
        or (lesson_number = 14 and period_count between 1 and 6)
      );
  end if;
end $$;

alter table lesson_occurrences drop constraint if exists lesson_occurrences_hour_check;
alter table lesson_occurrences
  add constraint lesson_occurrences_hour_check check (lesson_number between 1 and 19);

comment on column lessons.lesson_number is
  '1–13 numbered period. 14 = afternoon start (אחרי צהריים); period_count 1–6 opens meetings 14…';

notify pgrst, 'reload schema';

select '034 afternoon multi hour ok' as status;
