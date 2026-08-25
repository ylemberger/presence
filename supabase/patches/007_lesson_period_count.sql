-- שיעור יכול לתפוס כמה שעות רצופות (למשל שעה 1+2).
-- הריצי ב-Supabase SQL Editor. בטוח להרצה מחדש.

alter table lessons add column if not exists period_count smallint;

update lessons set period_count = 1 where period_count is null;

alter table lessons alter column period_count set default 1;

do $$
begin
  begin
    alter table lessons alter column period_count set not null;
  exception
    when others then null;
  end;
end $$;

alter table lessons drop constraint if exists lessons_period_count_check;
alter table lessons
  add constraint lessons_period_count_check check (period_count between 1 and 9);

alter table lessons drop constraint if exists lessons_period_span_check;
alter table lessons
  add constraint lessons_period_span_check
  check (lesson_number + period_count - 1 between 1 and 9);
