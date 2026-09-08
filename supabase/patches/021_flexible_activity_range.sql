-- טווח פעילות «גמיש» לשיעור בודד (בחירת תאריכים בלוח בעת יצירת השיעור).
-- בטוח להרצה חוזרת.

alter table activity_ranges drop constraint if exists activity_ranges_range_type_check;

alter table activity_ranges add constraint activity_ranges_range_type_check
  check (range_type in ('annual', 'semester_a', 'semester_b', 'course', 'flexible'));
