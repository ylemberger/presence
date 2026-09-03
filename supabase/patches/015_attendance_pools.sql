-- קיבוץ ידני של שיעורים לחישוב נוכחות משותף.
-- הוספה בלבד: לא מוחק טבלאות, שורות נוכחות, שיעורים או תלמידות.
-- בטוח להרצה חוזרת.

create table if not exists attendance_pools (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  unique (academic_year_id, name)
);

create index if not exists idx_attendance_pools_year
  on attendance_pools (academic_year_id);

create table if not exists attendance_pool_members (
  pool_id uuid not null references attendance_pools(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  primary key (pool_id, lesson_id)
);

create unique index if not exists attendance_pool_members_lesson_uidx
  on attendance_pool_members (lesson_id);

create index if not exists idx_attendance_pool_members_pool
  on attendance_pool_members (pool_id);

alter table attendance_pools enable row level security;
alter table attendance_pool_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_pools' and policyname = 'authenticated_select_attendance_pools'
  ) then
    create policy "authenticated_select_attendance_pools" on attendance_pools for select to authenticated using (true);
    create policy "authenticated_insert_attendance_pools" on attendance_pools for insert to authenticated with check (true);
    create policy "authenticated_update_attendance_pools" on attendance_pools for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_attendance_pools" on attendance_pools for delete to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_pool_members' and policyname = 'authenticated_select_attendance_pool_members'
  ) then
    create policy "authenticated_select_attendance_pool_members" on attendance_pool_members for select to authenticated using (true);
    create policy "authenticated_insert_attendance_pool_members" on attendance_pool_members for insert to authenticated with check (true);
    create policy "authenticated_update_attendance_pool_members" on attendance_pool_members for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_attendance_pool_members" on attendance_pool_members for delete to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';

select '015 attendance pools ok' as status;
