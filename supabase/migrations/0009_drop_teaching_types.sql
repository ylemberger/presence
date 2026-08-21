alter table student_assignments drop column if exists teaching_type_id;
alter table teachers drop column if exists teaching_type_id;
drop table if exists teaching_types cascade;
