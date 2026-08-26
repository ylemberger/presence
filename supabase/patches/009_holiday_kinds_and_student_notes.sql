-- חופשה מול ביטול לימודים, והערה אישית קבועה על תלמידה.

alter table holiday_periods
  add column if not exists kind text;

update holiday_periods set kind = 'vacation' where kind is null;

alter table holiday_periods
  drop constraint if exists holiday_periods_kind_check;

alter table holiday_periods
  alter column kind set default 'vacation';

alter table holiday_periods
  alter column kind set not null;

alter table holiday_periods
  add constraint holiday_periods_kind_check
    check (kind in ('vacation', 'cancelled_studies'));

alter table students
  add column if not exists personal_note text;
