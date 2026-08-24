-- מאפשר required_exams=0 עבור חסומות (סטטוס blocked)
-- הריצי ב-Supabase SQL Editor. בטוח להרצה מחדש.

alter table makeup_exams
  drop constraint if exists makeup_exams_required_exams_check;

alter table makeup_exams
  add constraint makeup_exams_required_exams_check
  check (required_exams between 0 and 4);

comment on column makeup_exams.required_exams is
  'Number of makeup exams required (0 = blocked / no makeup allowed)';

