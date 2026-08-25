-- לוח חופשות שנתי: ימים ללא לימודים. מופעי שיעור לא נוצרים בתאריכים האלה.
-- הריצי ב-Supabase SQL Editor. בטוח להרצה מחדש.

create table if not exists holiday_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  constraint holiday_periods_dates_check check (end_date >= start_date)
);

create index if not exists idx_holiday_periods_academic_year
  on holiday_periods (academic_year_id);

create index if not exists idx_holiday_periods_dates
  on holiday_periods (academic_year_id, start_date, end_date);

alter table holiday_periods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'holiday_periods' and policyname = 'authenticated_select_holiday_periods'
  ) then
    create policy "authenticated_select_holiday_periods" on holiday_periods for select to authenticated using (true);
    create policy "authenticated_insert_holiday_periods" on holiday_periods for insert to authenticated with check (true);
    create policy "authenticated_update_holiday_periods" on holiday_periods for update to authenticated using (true) with check (true);
    create policy "authenticated_delete_holiday_periods" on holiday_periods for delete to authenticated using (true);
  end if;
end $$;
