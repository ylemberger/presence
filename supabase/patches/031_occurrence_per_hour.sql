-- Each hour of a lesson is its own attendance meeting.
-- Hour 3 lasting 3 hours => meetings at hours 3, 4 and 5 on that date.
-- Afternoon (14) stays one meeting.
-- Existing marks stay on the original meeting and are copied onto the new hours,
-- so a week that was already filled stays filled. Nothing is deleted.
-- Safe to re-run: a later run does not copy marks again.

alter table lesson_occurrences
  add column if not exists lesson_number integer;

update lesson_occurrences o
set lesson_number = coalesce(
  (
    select s.lesson_number
    from lesson_weekly_slots s
    where s.lesson_id = o.lesson_id
      and s.day_of_week = extract(dow from o.occurrence_date)::int
    order by s.lesson_number
    limit 1
  ),
  (select l.lesson_number from lessons l where l.id = o.lesson_id),
  1
)
where o.lesson_number is null;

alter table lesson_occurrences drop constraint if exists lesson_occurrences_lesson_id_occurrence_date_key;

do $$
declare
  old_unique record;
begin
  for old_unique in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'lesson_occurrences'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) = 'UNIQUE (lesson_id, occurrence_date)'
  loop
    execute format('alter table lesson_occurrences drop constraint %I', old_unique.conname);
  end loop;
end $$;

alter table lesson_occurrences drop constraint if exists lesson_occurrences_hour_check;
alter table lesson_occurrences
  add constraint lesson_occurrences_hour_check check (lesson_number between 1 and 14);

alter table lesson_occurrences alter column lesson_number set not null;

alter table lesson_occurrences
  drop constraint if exists lesson_occurrences_lesson_id_occurrence_date_lesson_number_key;
alter table lesson_occurrences
  add constraint lesson_occurrences_lesson_id_occurrence_date_lesson_number_key
  unique (lesson_id, occurrence_date, lesson_number);

with inserted as (
  insert into lesson_occurrences (
    lesson_id, occurrence_date, status, lesson_number, gap_handling
  )
  select
    o.lesson_id,
    o.occurrence_date,
    o.status,
    o.lesson_number + g.n,
    o.gap_handling
  from lesson_occurrences o
  join lessons l on l.id = o.lesson_id
  left join lesson_weekly_slots s
    on s.lesson_id = o.lesson_id
   and s.day_of_week = extract(dow from o.occurrence_date)::int
  cross join lateral generate_series(
    1,
    coalesce(s.period_count, l.period_count, 1) - 1
  ) as g(n)
  where o.lesson_number between 1 and 13
    and o.lesson_number = coalesce(s.lesson_number, l.lesson_number)
    and coalesce(s.period_count, l.period_count, 1) > 1
    and o.lesson_number + g.n between 1 and 13
    and not exists (
      select 1
      from lesson_occurrences e
      where e.lesson_id = o.lesson_id
        and e.occurrence_date = o.occurrence_date
        and e.lesson_number = o.lesson_number + g.n
    )
  returning id, lesson_id, occurrence_date, lesson_number
)
insert into attendance (student_id, lesson_occurrence_id, status, reason)
select a.student_id, i.id, a.status, a.reason
from inserted i
join lessons l on l.id = i.lesson_id
left join lesson_weekly_slots s
  on s.lesson_id = i.lesson_id
 and s.day_of_week = extract(dow from i.occurrence_date)::int
join lesson_occurrences start_o
  on start_o.lesson_id = i.lesson_id
 and start_o.occurrence_date = i.occurrence_date
 and start_o.lesson_number = coalesce(s.lesson_number, l.lesson_number)
join attendance a on a.lesson_occurrence_id = start_o.id
where not exists (
  select 1
  from attendance x
  where x.lesson_occurrence_id = i.id
    and x.student_id = a.student_id
);

comment on column lesson_occurrences.lesson_number is
  'One attendance meeting for this hour. A lesson of 3 hours has 3 rows on the same date. Afternoon (14) is one row.';

notify pgrst, 'reload schema';

select '031 occurrence per hour ok' as status;
