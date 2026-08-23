-- Optional absence reason on attendance records.
-- Safe to re-run.

alter table attendance
  add column if not exists reason text
  check (
    reason is null
    or reason in ('illness', 'permission', 'family', 'unexcused')
  );

comment on column attendance.reason is
  'Optional absence reason: illness | permission | family | unexcused';

analyze attendance;
