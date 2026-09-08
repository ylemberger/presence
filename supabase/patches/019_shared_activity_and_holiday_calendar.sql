-- טווחי פעילות ולוח חופשות הם לוח מוסדי אחד לכל השנים.
-- מחיקת שנה אקדמית לא תמחק את הלוח.
-- בטוח להרצה חוזרת.

do $$
declare
  r record;
begin
  for r in
    select rel.relname as tbl, con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where nsp.nspname = 'public'
      and rel.relname in ('activity_ranges', 'holiday_periods')
      and con.contype = 'f'
      and att.attname = 'academic_year_id'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table activity_ranges
  alter column academic_year_id drop not null;

alter table holiday_periods
  alter column academic_year_id drop not null;

alter table activity_ranges
  add constraint activity_ranges_academic_year_id_fkey
  foreign key (academic_year_id) references academic_years(id) on delete set null;

alter table holiday_periods
  add constraint holiday_periods_academic_year_id_fkey
  foreign key (academic_year_id) references academic_years(id) on delete set null;
