delete from academic_years where name in ('׳×׳©׳₪"׳–', '׳×׳©׳₪"׳•');
delete from attendance_rules where name in ('׳›׳׳ 15%', '׳›׳׳ 10%', '׳¨׳’׳™׳ 20%', '׳‘׳˜׳™׳—׳•׳× 10%', '׳¢׳–׳¨׳” ׳¨׳׳©׳•׳ ׳” 1%');
delete from teacher_source_records where external_id like 'demo-%';

insert into students (full_name, identity_number, cohort_number, is_active) values
  ('׳ ׳•׳¢׳” ׳›׳”׳', '900000001', 1, true),
  ('׳©׳™׳¨׳” ׳׳•׳™', '900000002', 1, true),
  ('׳×׳׳¨ ׳׳‘׳¨׳”׳', '900000003', 2, true),
  ('׳™׳¢׳ ׳׳–׳¨׳—׳™', '900000004', 2, true),
  ('׳׳™׳›׳ ׳“׳•׳“', '900000005', 3, true),
  ('׳¨׳—׳ ׳’׳•׳׳“׳‘׳¨׳’', '900000006', 3, true),
  ('׳׳¡׳×׳¨ ׳₪׳¨׳¥', '900000007', 4, true),
  ('׳”׳™׳׳” ׳‘׳™׳˜׳•׳', '900000008', 4, true)
on conflict (identity_number) do update
  set full_name = excluded.full_name, is_active = true, cohort_number = excluded.cohort_number;

insert into teachers (full_name, identity_number, phone, email, is_local) values
  ('׳¨׳‘׳§׳” ׳©׳׳™׳¨', '800000001', '050-1112233', 'rivka.demo@example.com', true),
  ('׳“׳ ׳” ׳׳׳•׳', '800000002', '050-2223344', 'dana.demo@example.com', false),
  ('׳׳¨׳™׳ ׳—׳“׳“', '800000003', '050-3334455', 'miriam.demo@example.com', false)
on conflict (identity_number) do update
  set full_name = excluded.full_name, phone = excluded.phone, email = excluded.email;

insert into teacher_source_records (external_id, teacher_identity_number, full_name, subject, source_year) values
  ('demo-src-1', '800000002', '׳“׳ ׳” ׳׳׳•׳', '׳׳ ׳’׳׳™׳×', '׳×׳©׳₪"׳–'),
  ('demo-src-2', '800000003', '׳׳¨׳™׳ ׳—׳“׳“', '׳”׳™׳¡׳˜׳•׳¨׳™׳”', '׳×׳©׳₪"׳–'),
  ('demo-src-3', '800000003', '׳׳¨׳™׳ ׳—׳“׳“', '׳¡׳₪׳¨׳•׳×', '׳×׳©׳₪"׳–')
on conflict (external_id) do nothing;

insert into attendance_rules (name, max_allowed_absence_percent) values
  ('׳¨׳’׳™׳ 20%', 20),
  ('׳‘׳˜׳™׳—׳•׳× 10%', 10),
  ('׳¢׳–׳¨׳” ׳¨׳׳©׳•׳ ׳” 1%', 1);

do $$
declare
  year_id uuid;
  grade_a uuid;
  grade_b uuid;
  class_a1 uuid;
  class_a2 uuid;
  class_b1 uuid;
  track_iyuni uuid;
  track_computers uuid;
  spec_account uuid;
  spec_design uuid;
  range_year uuid;
  range_a uuid;
  rule_regular uuid;
  rule_safety uuid;
  t_rivka uuid;
  t_dana uuid;
  t_miriam uuid;
  ta_math uuid;
  ta_english uuid;
  ta_history uuid;
  lesson_math uuid;
  lesson_english uuid;
  lesson_history uuid;
  s_noa uuid;
  s_shira uuid;
  s_tamar uuid;
  s_yael uuid;
  s_michal uuid;
  s_rachel uuid;
  s_esther uuid;
  s_hila uuid;
  occ_id uuid;
  d date;
begin
  update academic_years set is_active = false;
  insert into academic_years (name, is_active) values ('׳×׳©׳₪"׳–', true) returning id into year_id;

  insert into grades (academic_year_id, name) values (year_id, 'א') returning id into grade_a;
  insert into grades (academic_year_id, name) values (year_id, 'ב') returning id into grade_b;

  insert into classes (academic_year_id, grade_id, name) values (year_id, grade_a, '׳1') returning id into class_a1;
  insert into classes (academic_year_id, grade_id, name) values (year_id, grade_a, '׳2') returning id into class_a2;
  insert into classes (academic_year_id, grade_id, name) values (year_id, grade_b, '׳‘1') returning id into class_b1;

  insert into tracks (academic_year_id, name) values (year_id, '׳¢׳™׳•׳ ׳™') returning id into track_iyuni;
  insert into tracks (academic_year_id, name) values (year_id, '׳׳—׳©׳‘׳™׳') returning id into track_computers;

  insert into specializations (academic_year_id, name) values (year_id, '׳—׳©׳‘׳•׳ ׳׳•׳×') returning id into spec_account;
  insert into specializations (academic_year_id, name) values (year_id, '׳¢׳™׳¦׳•׳‘') returning id into spec_design;

  insert into grades (academic_year_id, name) values (year_id, 'ג');
  insert into teaching_types (academic_year_id, name) values
    (year_id, 'הוראה'),
    (year_id, 'גננות');

  insert into activity_ranges (academic_year_id, name, start_date, end_date, range_type)
  values (year_id, '׳©׳ ׳×׳™', '2026-09-01', '2027-06-30', 'annual') returning id into range_year;
  insert into activity_ranges (academic_year_id, name, start_date, end_date, range_type)
  values (year_id, '׳׳—׳¦׳™׳× ׳', '2026-09-01', '2027-01-31', 'semester_a') returning id into range_a;

  select id into rule_regular from attendance_rules where name = '׳¨׳’׳™׳ 20%';
  select id into rule_safety from attendance_rules where name = '׳‘׳˜׳™׳—׳•׳× 10%';

  select id into t_rivka from teachers where identity_number = '800000001';
  select id into t_dana from teachers where identity_number = '800000002';
  select id into t_miriam from teachers where identity_number = '800000003';

  insert into teacher_teaching_assignments (teacher_id, academic_year_id, subject, billing_type, grade_id, class_id, track_id)
  values (t_rivka, year_id, '׳׳×׳׳˜׳™׳§׳”', 'mandatory', grade_a, class_a1, track_iyuni) returning id into ta_math;
  insert into teacher_teaching_assignments (teacher_id, academic_year_id, subject, billing_type, grade_id, class_id, track_id)
  values (t_dana, year_id, '׳׳ ׳’׳׳™׳×', 'mandatory', grade_a, class_a1, track_iyuni) returning id into ta_english;
  insert into teacher_teaching_assignments (teacher_id, academic_year_id, subject, billing_type, grade_id, specialization_id)
  values (t_miriam, year_id, '׳”׳™׳¡׳˜׳•׳¨׳™׳”', 'specialization', grade_b, spec_account) returning id into ta_history;

  insert into lessons (
    academic_year_id, teacher_teaching_assignment_id, subject, grade_id, class_id, track_id,
    billing_type, day_of_week, lesson_number, activity_range_id, attendance_rule_id
  ) values (
    year_id, ta_math, '׳׳×׳׳˜׳™׳§׳”', grade_a, class_a1, track_iyuni,
    'mandatory', 0, 2, range_year, rule_regular
  ) returning id into lesson_math;

  insert into lessons (
    academic_year_id, teacher_teaching_assignment_id, subject, grade_id, class_id, track_id,
    billing_type, day_of_week, lesson_number, activity_range_id, attendance_rule_id
  ) values (
    year_id, ta_english, '׳׳ ׳’׳׳™׳×', grade_a, class_a1, track_iyuni,
    'mandatory', 2, 3, range_year, rule_regular
  ) returning id into lesson_english;

  insert into lessons (
    academic_year_id, teacher_teaching_assignment_id, subject, grade_id, specialization_id,
    billing_type, day_of_week, lesson_number, activity_range_id, attendance_rule_id
  ) values (
    year_id, ta_history, '׳”׳™׳¡׳˜׳•׳¨׳™׳”', grade_b, spec_account,
    'specialization', 4, 1, range_a, rule_safety
  ) returning id into lesson_history;

  select id into s_noa from students where identity_number = '900000001';
  select id into s_shira from students where identity_number = '900000002';
  select id into s_tamar from students where identity_number = '900000003';
  select id into s_yael from students where identity_number = '900000004';
  select id into s_michal from students where identity_number = '900000005';
  select id into s_rachel from students where identity_number = '900000006';
  select id into s_esther from students where identity_number = '900000007';
  select id into s_hila from students where identity_number = '900000008';

  insert into student_assignments (student_id, academic_year_id, grade_id, class_id, track_id, specialization_id, start_date, end_date) values
    (s_noa, year_id, grade_a, class_a1, track_iyuni, null, '2026-09-01', '2026-11-30');
  insert into student_assignments (student_id, academic_year_id, grade_id, class_id, track_id, specialization_id, start_date, end_date) values
    (s_noa, year_id, grade_a, class_a2, track_computers, spec_design, '2026-12-01', null),
    (s_shira, year_id, grade_a, class_a1, track_iyuni, null, '2026-09-01', null),
    (s_tamar, year_id, grade_a, class_a1, track_iyuni, spec_account, '2026-09-01', null),
    (s_yael, year_id, grade_a, class_a2, track_computers, spec_design, '2026-09-01', null),
    (s_michal, year_id, grade_a, class_a2, track_computers, null, '2026-09-01', null),
    (s_rachel, year_id, grade_b, class_b1, track_iyuni, spec_account, '2026-09-01', null),
    (s_esther, year_id, grade_b, class_b1, track_iyuni, spec_account, '2026-09-01', null),
    (s_hila, year_id, grade_b, class_b1, track_iyuni, spec_design, '2026-09-01', null);

  insert into student_lesson_assignments (student_id, lesson_id, assignment_type, start_date, end_date) values
    (s_noa, lesson_math, 'automatic', '2026-09-01', '2026-11-30'),
    (s_shira, lesson_math, 'automatic', '2026-09-01', null),
    (s_tamar, lesson_math, 'automatic', '2026-09-01', null),
    (s_shira, lesson_english, 'automatic', '2026-09-01', null),
    (s_tamar, lesson_english, 'automatic', '2026-09-01', null),
    (s_yael, lesson_english, 'manual', '2026-09-01', null),
    (s_rachel, lesson_history, 'automatic', '2026-09-01', null),
    (s_esther, lesson_history, 'automatic', '2026-09-01', null),
    (s_hila, lesson_history, 'automatic', '2026-09-01', null);

  d := date '2026-09-06';
  while d <= date '2026-10-25' loop
    insert into lesson_occurrences (lesson_id, occurrence_date, status)
    values (lesson_math, d, case when d < date '2026-10-01' then 'completed' else 'scheduled' end);
    d := d + 7;
  end loop;

  d := date '2026-09-08';
  while d <= date '2026-10-27' loop
    insert into lesson_occurrences (lesson_id, occurrence_date, status)
    values (lesson_english, d, case when d < date '2026-10-01' then 'completed' else 'scheduled' end);
    d := d + 7;
  end loop;

  d := date '2026-09-10';
  while d <= date '2026-10-29' loop
    insert into lesson_occurrences (lesson_id, occurrence_date, status)
    values (lesson_history, d, case when d < date '2026-10-01' then 'completed' else 'scheduled' end);
    d := d + 7;
  end loop;

  for occ_id in select id from lesson_occurrences where lesson_id = lesson_math and status = 'completed' order by occurrence_date loop
    insert into attendance (student_id, lesson_occurrence_id, status) values
      (s_shira, occ_id, 'present'),
      (s_tamar, occ_id, 'late');
  end loop;

  for occ_id in select id from lesson_occurrences where lesson_id = lesson_english and status = 'completed' order by occurrence_date limit 2 loop
    insert into attendance (student_id, lesson_occurrence_id, status) values
      (s_shira, occ_id, 'present'),
      (s_tamar, occ_id, 'absent'),
      (s_yael, occ_id, 'present');
  end loop;

  for occ_id in select id from lesson_occurrences where lesson_id = lesson_history and status = 'completed' order by occurrence_date limit 3 loop
    insert into attendance (student_id, lesson_occurrence_id, status) values
      (s_rachel, occ_id, 'present'),
      (s_esther, occ_id, 'present'),
      (s_hila, occ_id, 'absent');
  end loop;
end $$;

