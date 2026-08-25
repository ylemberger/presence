-- בחירה מרובה לקהל שיעור (כיתות / מסלולים / התמחויות) עם התאמת OR.
-- מאפשר גם שיעור לכל השכבה (בלי כיתה/מסלול).
-- הריצי ב-Supabase SQL Editor. בטוח להרצה מחדש.

create table if not exists lesson_audience (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  specialization_id uuid references specializations(id) on delete cascade,
  constraint lesson_audience_one_target check (
    (class_id is not null)::int
    + (track_id is not null)::int
    + (specialization_id is not null)::int = 1
  )
);

create unique index if not exists idx_lesson_audience_class
  on lesson_audience (lesson_id, class_id)
  where class_id is not null;

create unique index if not exists idx_lesson_audience_track
  on lesson_audience (lesson_id, track_id)
  where track_id is not null;

create unique index if not exists idx_lesson_audience_spec
  on lesson_audience (lesson_id, specialization_id)
  where specialization_id is not null;

create index if not exists idx_lesson_audience_lesson on lesson_audience (lesson_id);

alter table lesson_audience enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lesson_audience' and policyname = 'authenticated_select_lesson_audience'
  ) then
    create policy "authenticated_select_lesson_audience" on lesson_audience for select to authenticated using (true);
    create policy "authenticated_insert_lesson_audience" on lesson_audience for insert to authenticated with check (true);
    create policy "authenticated_update_lesson_audience" on lesson_audience for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_lesson_audience" on lesson_audience for delete to authenticated using (true);
  end if;
end $$;

-- שיעור חובה יכול להיות לכל השכבה (בלי כיתה/מסלול). התמחויות נוספות נשמרות ב-lesson_audience.
alter table lessons drop constraint if exists lessons_billing_scope_check;
alter table lessons
  add constraint lessons_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
    )
  );

alter table teacher_teaching_assignments drop constraint if exists tta_billing_scope_check;
alter table teacher_teaching_assignments
  add constraint tta_billing_scope_check check (
    (
      billing_type = 'specialization'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and for_psychology = false
    )
    or (
      billing_type = 'mandatory'
      and specialization_id is null
    )
  );

-- מילוי מקהל קיים (עמודות בודדות)
insert into lesson_audience (lesson_id, class_id)
select l.id, l.class_id
from lessons l
where l.class_id is not null
  and not exists (
    select 1 from lesson_audience a
    where a.lesson_id = l.id and a.class_id = l.class_id
  );

insert into lesson_audience (lesson_id, track_id)
select l.id, l.track_id
from lessons l
where l.track_id is not null
  and not exists (
    select 1 from lesson_audience a
    where a.lesson_id = l.id and a.track_id = l.track_id
  );

insert into lesson_audience (lesson_id, specialization_id)
select l.id, l.specialization_id
from lessons l
where l.specialization_id is not null
  and not exists (
    select 1 from lesson_audience a
    where a.lesson_id = l.id and a.specialization_id = l.specialization_id
  );
