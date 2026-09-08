-- אפשר שיעור 10 (שעת התחלה, משך רצוף, וסכום השעות עד 10).
-- בטוח להרצה חוזרת.

alter table lessons drop constraint if exists lessons_lesson_number_check;
alter table lessons add constraint lessons_lesson_number_check
  check (lesson_number between 1 and 10);

alter table lessons drop constraint if exists lessons_period_count_check;
alter table lessons add constraint lessons_period_count_check
  check (period_count between 1 and 10);

alter table lessons drop constraint if exists lessons_period_span_check;
alter table lessons add constraint lessons_period_span_check
  check (lesson_number + period_count - 1 between 1 and 10);
