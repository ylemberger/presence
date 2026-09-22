-- Multiple weekly meeting times for one lesson template.
-- Keeps lessons.day_of_week / lesson_number / period_count as the primary (first) slot.
-- Safe to re-run.

create table if not exists lesson_weekly_slots (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  lesson_number smallint not null check (lesson_number between 1 and 10),
  period_count smallint not null default 1 check (period_count between 1 and 10),
  constraint lesson_weekly_slots_period_span_check
    check (lesson_number + period_count - 1 between 1 and 10),
  unique (lesson_id, day_of_week)
);

create index if not exists idx_lesson_weekly_slots_lesson
  on lesson_weekly_slots (lesson_id);

comment on table lesson_weekly_slots is
  'Weekly meeting times for a lesson (e.g. Sunday periods 6-7 and Wednesday period 3). One row per weekday.';

alter table lesson_weekly_slots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lesson_weekly_slots'
      and policyname = 'authenticated_select_lesson_weekly_slots'
  ) then
    create policy "authenticated_select_lesson_weekly_slots"
      on lesson_weekly_slots for select to authenticated using (true);
    create policy "authenticated_insert_lesson_weekly_slots"
      on lesson_weekly_slots for insert to authenticated with check (true);
    create policy "authenticated_update_lesson_weekly_slots"
      on lesson_weekly_slots for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_lesson_weekly_slots"
      on lesson_weekly_slots for delete to authenticated using (true);
  end if;
end $$;

-- Backfill one slot from existing lesson schedule columns.
insert into lesson_weekly_slots (lesson_id, day_of_week, lesson_number, period_count)
select l.id, l.day_of_week, l.lesson_number, coalesce(l.period_count, 1)
from lessons l
where not exists (
  select 1 from lesson_weekly_slots s where s.lesson_id = l.id
);

notify pgrst, 'reload schema';

select '023 lesson weekly slots ok' as status;
