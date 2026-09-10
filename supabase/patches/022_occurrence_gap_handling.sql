-- Gap handling on incomplete past lesson occurrences (attendance blocking modal).
-- Safe to re-run.

alter table lesson_occurrences
  add column if not exists gap_handling text;

alter table lesson_occurrences
  drop constraint if exists lesson_occurrences_gap_handling_check;

alter table lesson_occurrences
  add constraint lesson_occurrences_gap_handling_check
  check (
    gap_handling is null
    or gap_handling in ('in_treatment', 'continued')
  );

comment on column lesson_occurrences.gap_handling is
  'How an incomplete past occurrence was handled: in_treatment | continued';

create index if not exists idx_lo_gap_handling on lesson_occurrences (gap_handling);

analyze lesson_occurrences;
