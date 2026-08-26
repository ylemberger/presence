-- =============================================================================
-- מחיקת כל התלמידות + (אופציונלי) 35 תלמידות לבדיקת קידום שנה / ארכיון
-- הריצי ב-Supabase SQL Editor על המסד הקיים.
-- =============================================================================

-- 1) מחיקת כל התלמידות (cascade: שיבוצים, נוכחות, שיוך לשיעורים, הערות תלמידה…)
delete from students;

-- 2) וידוא קטלוג דמו בשנה הפעילה (כיתות / מסלולים / התמחויות)
do $$
declare
  y uuid;
  g_a uuid;
  g_b uuid;
  g_c uuid;
begin
  select id into y from academic_years where is_active = true limit 1;
  if y is null then
    raise exception 'אין שנה פעילה — צרי שנה בהגדרות לפני ההרצה';
  end if;

  insert into grades (academic_year_id, name)
  select y, n from unnest(array['א','ב','ג']) as n
  where not exists (
    select 1 from grades g where g.academic_year_id = y and g.name = n
  );

  select id into g_a from grades where academic_year_id = y and name = 'א';
  select id into g_b from grades where academic_year_id = y and name = 'ב';
  select id into g_c from grades where academic_year_id = y and name = 'ג';

  -- כיתות
  insert into classes (academic_year_id, grade_id, name)
  select y, g_a, n from unnest(array['יג 1','יג 2']) as n
  where not exists (select 1 from classes c where c.academic_year_id = y and c.grade_id = g_a and c.name = n);

  insert into classes (academic_year_id, grade_id, name)
  select y, g_b, n from unnest(array['יד 1','יד 2']) as n
  where not exists (select 1 from classes c where c.academic_year_id = y and c.grade_id = g_b and c.name = n);

  insert into classes (academic_year_id, grade_id, name)
  select y, g_c, 'שנה ג'
  where not exists (select 1 from classes c where c.academic_year_id = y and c.grade_id = g_c and c.name = 'שנה ג');

  -- מסלולים
  insert into tracks (academic_year_id, name)
  select y, n from unnest(array['הוראה','הוראה מקוצרת','הוראת מדעי המחשב','ללא הוראה']) as n
  where not exists (select 1 from tracks t where t.academic_year_id = y and t.name = n);

  -- התמחויות
  insert into specializations (academic_year_id, name)
  select y, n from unnest(array[
    'אדריכלות','גרפיקה','הוראה מתקנת','חינוך מיוחד','חשבונאות','תכנות','תנך'
  ]) as n
  where not exists (select 1 from specializations s where s.academic_year_id = y and s.name = n);
end $$;

-- 3) 35 תלמידות לבדיקת קידום: 12 שכבה א, 12 שכבה ב, 11 שכבה ג
do $$
declare
  y uuid;
  g_a uuid; g_b uuid; g_c uuid;
  c_a1 uuid; c_a2 uuid; c_b1 uuid; c_b2 uuid; c_c uuid;
  track_ids uuid[];
  spec_ids uuid[];
  i int;
  sid uuid;
  gid uuid;
  cid uuid;
  tid uuid;
  spid uuid;
  sec uuid;
  firstn text;
  lastn text;
  idnum text;
  firsts text[] := array[
    'רחל','שרה','מרים','חנה','רבקה','לאה','אסתר','דינה','יעל','תמר',
    'נעמי','ברכה','פייגי','מלכה','רותי','גיטי','ציפורה','גולדה','בתיה','שולמית',
    'הדסה','אסנת','יהודית','פנינה','רייזי','בילא','שיינדל','פרידה','חוה','מיכל',
    'אילה','נועה','שירה','עדי','ליאת'
  ];
  lasts text[] := array[
    'כהן','לוי','גולד','פריד','שטרן','ברקוביץ','וייס','קליין','רוזן','הלוי',
    'זילבר','שוורץ','גרין','ברג','אדלר','זוסמן','פרידמן','קפלן','הורוביץ','שפירא',
    'גרוס','פינקל','לנדא','אייזן','ברוך','סגל','מלמד','אופן','רייך','נוי',
    'דוד','אברהם','יצחק','יעקב','בנימין'
  ];
  cities text[] := array['ירושלים','בני ברק','אשדוד','מודיעין עילית','ביתר עילית','אלעד','חיפה'];
begin
  select id into y from academic_years where is_active = true limit 1;

  select id into g_a from grades where academic_year_id = y and name = 'א';
  select id into g_b from grades where academic_year_id = y and name = 'ב';
  select id into g_c from grades where academic_year_id = y and name = 'ג';

  select id into c_a1 from classes where academic_year_id = y and grade_id = g_a and name = 'יג 1';
  select id into c_a2 from classes where academic_year_id = y and grade_id = g_a and name = 'יג 2';
  select id into c_b1 from classes where academic_year_id = y and grade_id = g_b and name = 'יד 1';
  select id into c_b2 from classes where academic_year_id = y and grade_id = g_b and name = 'יד 2';
  select id into c_c from classes where academic_year_id = y and grade_id = g_c and name = 'שנה ג';

  select array_agg(id order by name) into track_ids from tracks where academic_year_id = y;
  select array_agg(id order by name) into spec_ids from specializations where academic_year_id = y;

  for i in 1..35 loop
    firstn := firsts[((i - 1) % array_length(firsts, 1)) + 1];
    lastn := lasts[((i - 1) % array_length(lasts, 1)) + 1];
    idnum := lpad((300000000 + i)::text, 9, '0');

    if i <= 12 then
      gid := g_a;
      cid := case when i % 2 = 1 then c_a1 else c_a2 end;
    elsif i <= 24 then
      gid := g_b;
      cid := case when i % 2 = 1 then c_b1 else c_b2 end;
    else
      gid := g_c;
      cid := c_c;
    end if;

    tid := track_ids[((i - 1) % array_length(track_ids, 1)) + 1];
    spid := spec_ids[((i - 1) % array_length(spec_ids, 1)) + 1];
    sec := case when i % 7 = 0 then spec_ids[(i % array_length(spec_ids, 1)) + 1] else null end;
    if sec is not null and sec = spid then sec := null; end if;

    insert into students (
      full_name, first_name, last_name, mi, identity_number, cohort_number,
      birth_date, birth_date_hebrew, address, city,
      phone, father_phone, mother_phone, student_phone,
      high_school, chetz_program, is_active
    ) values (
      firstn || ' ' || lastn,
      firstn,
      lastn,
      case when i % 5 = 0 then 'א' else null end,
      idnum,
      case when i <= 12 then 5 when i <= 24 then 4 else 3 end,
      ('2005-01-01'::date + (i * 37)),
      'ט״ו בשבט תשס״ה',
      'רחוב הדקל ' || i,
      cities[((i - 1) % array_length(cities, 1)) + 1],
      '02-500' || lpad(i::text, 4, '0'),
      '050-700' || lpad(i::text, 4, '0'),
      '052-800' || lpad(i::text, 4, '0'),
      '058-900' || lpad(i::text, 4, '0'),
      case when i % 3 = 0 then 'בית יעקב' else 'הסמינר העירוני' end,
      (i % 6 = 0),
      true
    )
    returning id into sid;

    insert into student_assignments (
      student_id, academic_year_id, grade_id, class_id, track_id,
      specialization_id, secondary_specialization_id, is_psychology,
      start_date, end_date
    ) values (
      sid, y, gid, cid, tid, spid, sec, (i % 11 = 0),
      current_date, null
    );
  end loop;
end $$;

select
  (select count(*) from students) as students_count,
  (select count(*) from student_assignments where end_date is null) as open_assignments,
  'wipe + 35 promo-test students ready' as status;
