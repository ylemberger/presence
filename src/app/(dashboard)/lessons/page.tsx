import { createClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { LessonsCalendar } from "./LessonsCalendar";
import { LessonsByDate, type CalendarMeeting } from "./LessonsByDate";
import { type LessonFormDraft } from "./LessonsForm";
import { LessonsFormDialog } from "./LessonsFormDialog";
import { LessonsFilters } from "./LessonsFilters";
import { filterFixedGrades } from "@/lib/years/grades";
import type { Lesson } from "@/types/database";
import {
  audienceForLesson,
  audienceMapFromRows,
  lessonMatchesAudienceFilter,
} from "@/lib/lessons/autoAssign";
import { describeAudienceScope } from "@/lib/validation";
import { formatLessonOptionLabel } from "@/lib/lessons/hours";
import { formatSubjectLessonLabel } from "@/lib/lessons/subject-label";
import {
  formatWeeklySlotsLabel,
  slotsFromLessonAndRows,
} from "@/lib/lessons/weekly-slots";
import { fetchAttendancePools, fingerprintForLesson } from "@/lib/attendance/pools";
import { formatLessonGroupLabel } from "@/lib/lessons/group-label";
import { AttendancePoolsPanel } from "./AttendancePoolsPanel";
import {
  salaryDisplayFields,
  uniqueSalaryAssignments,
} from "@/lib/teachers/salary-display";
import {
  fetchTeacherSourceRecords,
  groupSourceRowsByTeacher,
} from "@/lib/teachers/source-records";
import {
  representativeTeacherId,
  teacherIdsSharingName,
  uniqueTeachersByName,
} from "@/lib/teachers/name-group";
import { chunkIds, fetchAllPages, fetchAssignmentsByLessons } from "@/lib/supabase/paged";
import { buildHebrewMonth, hebrewMonthFromIso, parseIsoDate, todayIso } from "@/lib/dates/hebrew";
import {
  holidayDatesByKind,
  isMissingHolidayKind,
  isMissingHolidayTable,
} from "@/lib/lessons/holidays";
import type { LessonTemplateCard } from "./LessonsCalendar";
import type { LessonFormTeacher } from "./LessonsForm";

interface Props {
  searchParams: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    edit?: string;
    date?: string;
  };
}

function resolveIsoDay(raw?: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayIso();
  const parsed = parseIsoDate(raw);
  const [year, month, day] = raw.split("-").map(Number);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return todayIso();
  }
  return raw;
}

async function loadHolidayRows(supabase: Awaited<ReturnType<typeof createClient>>) {
  const withKind = await supabase.from("holiday_periods").select("start_date, end_date, kind");
  if (!withKind.error) return withKind.data ?? [];
  if (!isMissingHolidayKind(withKind.error) && !isMissingHolidayTable(withKind.error)) return [];
  if (!isMissingHolidayKind(withKind.error)) return [];
  const plain = await supabase.from("holiday_periods").select("start_date, end_date");
  if (plain.error) return [];
  return (plain.data ?? []).map((row) => ({ ...row, kind: null }));
}

function one<T>(v: unknown): T | null {
  if (!v) return null;
  return (Array.isArray(v) ? v[0] : v) as T;
}

export default async function LessonsPage({ searchParams }: Props) {
  const activeYear = await getActiveAcademicYear();
  const supabase = await createClient();

  if (!activeYear) {
    return (
      <div>
        <PageHeader
          title="שיעורים"
          description="יש להגדיר שנה אקדמית פעילה תחילה."
        />
      </div>
    );
  }

  const [lessonsRes, teachers, sourceRows, grades, classes, tracks, specializations, subjectsRes, ranges, rules, audienceRes, yearStudentsRes, weeklySlotsRes] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          `
          *,
          subjects(name),
          teacher_teaching_assignments(teacher_id, teachers(full_name)),
          classes(name),
          tracks(name),
          specializations(name)
        `
        )
        .eq("academic_year_id", activeYear.id)
        .order("day_of_week"),
      supabase.from("teachers").select("id, full_name, identity_number").order("full_name"),
      fetchTeacherSourceRecords(supabase),
      supabase.from("grades").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("classes")
        .select("id, name, grade_id")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase.from("tracks").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase
        .from("specializations")
        .select("id, name")
        .eq("academic_year_id", activeYear.id)
        .order("name"),
      supabase.from("subjects").select("id, name").eq("academic_year_id", activeYear.id).order("name"),
      supabase.from("activity_ranges").select("*"),
      supabase.from("attendance_rules").select("*"),
      supabase.from("lesson_audience").select("lesson_id, grade_id, class_id, track_id, specialization_id"),
      supabase
        .from("student_assignments")
        .select("student_id, students(id, full_name, is_active)")
        .eq("academic_year_id", activeYear.id)
        .is("end_date", null),
      supabase
        .from("lesson_weekly_slots")
        .select("lesson_id, day_of_week, lesson_number, period_count"),
    ]);

  type LessonRow = Lesson & {
    subjects?: { name: string } | { name: string }[] | null;
    teacher_teaching_assignments?: unknown;
    classes?: unknown;
    tracks?: unknown;
    specializations?: unknown;
  };

  const allLessons = (lessonsRes.data ?? []) as LessonRow[];
  const audienceByLesson = audienceMapFromRows(audienceRes.data ?? []);
  const weeklySlotRowsByLesson = new Map<
    string,
    { day_of_week: number; lesson_number: number; period_count: number }[]
  >();
  for (const row of weeklySlotsRes.data ?? []) {
    const list = weeklySlotRowsByLesson.get(row.lesson_id) ?? [];
    list.push({
      day_of_week: row.day_of_week,
      lesson_number: row.lesson_number,
      period_count: row.period_count,
    });
    weeklySlotRowsByLesson.set(row.lesson_id, list);
  }
  const weeklySlotsByLesson = new Map(
    allLessons.map((l) => [
      l.id,
      slotsFromLessonAndRows(l, weeklySlotRowsByLesson.get(l.id)),
    ])
  );
  const filteredLessons = allLessons.filter((l) => {
    if (
      !lessonMatchesAudienceFilter(audienceForLesson(l, audienceByLesson), {
        classId: searchParams.classId,
        trackId: searchParams.trackId,
        specializationId: searchParams.specializationId,
      })
    ) {
      return false;
    }
    if (searchParams.subject) {
      const parentName = one<{ name: string }>(l.subjects)?.name ?? "";
      if (parentName !== searchParams.subject && l.subject !== searchParams.subject) return false;
    }
    if (searchParams.teacherId) {
      const assignment = one<{ teacher_id: string }>(l.teacher_teaching_assignments);
      const matchingTeacherIds = teacherIdsSharingName(
        teachers.data ?? [],
        searchParams.teacherId
      );
      if (!assignment?.teacher_id || !matchingTeacherIds.has(assignment.teacher_id)) {
        return false;
      }
    }
    return true;
  });

  const filteredIds = filteredLessons.map((l) => l.id);
  const yearSubjects = subjectsRes.data ?? [];
  const subjects = [...new Set(yearSubjects.map((s) => s.name))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const slaRows = await fetchAssignmentsByLessons<{ lesson_id: string }>(
    supabase,
    filteredIds,
    "lesson_id",
    true
  );

  const studentCountByLesson = new Map<string, number>();
  for (const row of slaRows) {
    studentCountByLesson.set(row.lesson_id, (studentCountByLesson.get(row.lesson_id) ?? 0) + 1);
  }

  const gradeById = new Map((grades.data ?? []).map((g) => [g.id, g.name]));
  const classById = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
  const trackById = new Map((tracks.data ?? []).map((t) => [t.id, t.name]));
  const specById = new Map((specializations.data ?? []).map((s) => [s.id, s.name]));
  const rangeById = new Map((ranges.data ?? []).map((r) => [r.id, r.name]));

  const poolCatalog = await fetchAttendancePools(supabase, activeYear.id);
  const poolViews = poolCatalog.pools.map((p) => ({
    id: p.id,
    name: p.name,
    lessonIds: poolCatalog.members.filter((m) => m.pool_id === p.id).map((m) => m.lesson_id),
  }));
  const poolLessonOptions = allLessons.map((l) => {
    const assignment = one<{ teachers?: unknown }>(l.teacher_teaching_assignments);
    const teacherName = one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "";
    const audience = audienceForLesson(l, audienceByLesson);
    const groupLabel = formatLessonGroupLabel({
      billingType: l.billing_type,
      forPsychology: Boolean(l.for_psychology),
      gradeNames: audience.grade_ids.map((id) => gradeById.get(id) ?? "").filter(Boolean),
      classNames: audience.class_ids.map((id) => classById.get(id) ?? "").filter(Boolean),
      trackNames: audience.track_ids.map((id) => trackById.get(id) ?? "").filter(Boolean),
      specializationNames: audience.specialization_ids
        .map((id) => specById.get(id) ?? "")
        .filter(Boolean),
    });
    const unit = poolCatalog.byLesson.get(l.id);
    return {
      id: l.id,
      label: [
        formatLessonOptionLabel({
          subject: formatSubjectLessonLabel(one<{ name: string }>(l.subjects)?.name, l.subject),
          day_of_week: l.day_of_week,
          lesson_number: l.lesson_number,
          period_count: l.period_count,
        }),
        groupLabel,
        teacherName,
      ]
        .filter(Boolean)
        .join(" · "),
      fingerprint: fingerprintForLesson(audience, Boolean(l.for_psychology)),
      poolId: unit?.poolId ?? null,
      poolName: unit?.poolName ?? null,
    };
  });

  const yearStudents = [...new Map(
    (yearStudentsRes.data ?? [])
      .map((row) => {
        const s = row.students as unknown as { id: string; full_name: string; is_active: boolean } | null;
        return s?.is_active ? ([s.id, { id: s.id, full_name: s.full_name }] as const) : null;
      })
      .filter((v): v is readonly [string, { id: string; full_name: string }] => Boolean(v))
  ).values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));

  const markedByLesson = new Map<string, { id: string; date: string }[]>();
  const yearLessonIds = allLessons.map((l) => l.id);
  if (yearLessonIds.length > 0) {
    const markedPages = await Promise.all(
      chunkIds(yearLessonIds).map((ids) =>
        fetchAllPages<{ id: string; lesson_id: string; occurrence_date: string }>(
          (from, to) =>
            supabase
              .from("lesson_occurrences")
              .select("id, lesson_id, occurrence_date, attendance!inner(id)")
              .in("lesson_id", ids)
              .order("occurrence_date")
              .range(from, to)
        )
      )
    );
    const seen = new Set<string>();
    for (const row of markedPages.flat()) {
      if (!row.id || !row.lesson_id || seen.has(row.id)) continue;
      seen.add(row.id);
      const list = markedByLesson.get(row.lesson_id) ?? [];
      list.push({ id: row.id, date: row.occurrence_date });
      markedByLesson.set(row.lesson_id, list);
    }
  }

  const lessonCards: LessonTemplateCard[] = filteredLessons.map((l) => {
    const assignment = one<{ teacher_id: string; teachers?: unknown }>(l.teacher_teaching_assignments);
    const teacherName = one<{ full_name: string }>(assignment?.teachers)?.full_name ?? "";
    const audience = audienceForLesson(l, audienceByLesson);
    const gradeNames =
      audience.grade_ids.length > 0
        ? audience.grade_ids
            .map((id) => gradeById.get(id))
            .filter((n): n is string => Boolean(n))
        : [gradeById.get(l.grade_id)].filter((n): n is string => Boolean(n));
    const audienceLabel = describeAudienceScope({
      billing_type: l.billing_type,
      gradeNames,
      classNames: audience.class_ids.map((id) => classById.get(id)).filter((n): n is string => Boolean(n)),
      trackNames: audience.track_ids.map((id) => trackById.get(id)).filter((n): n is string => Boolean(n)),
      specializationNames: audience.specialization_ids
        .map((id) => specById.get(id))
        .filter((n): n is string => Boolean(n)),
      forPsychology: l.for_psychology,
      wholeGrade:
        audience.class_ids.length === 0 &&
        audience.track_ids.length === 0 &&
        audience.specialization_ids.length === 0,
    });
    return {
      ...l,
      subject: l.subject,
      subjectParentName: one<{ name: string }>(l.subjects)?.name ?? "",
      teacherName,
      gradeName: gradeNames.join(" / ") || (gradeById.get(l.grade_id) ?? ""),
      audienceLabel,
      scheduleLabel: [
        formatWeeklySlotsLabel(weeklySlotsByLesson.get(l.id) ?? []),
        l.repeat_every_weeks === 2 ? "פעם בשבועיים" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      rangeName: rangeById.get(l.activity_range_id) ?? "",
      studentCount: studentCountByLesson.get(l.id) ?? 0,
      attendanceLocked: markedByLesson.has(l.id),
      markedMeetings: markedByLesson.get(l.id) ?? [],
    };
  });

  const selectedDate = resolveIsoDay(searchParams.date);
  const monthCursor = hebrewMonthFromIso(selectedDate);
  const monthGrid = buildHebrewMonth(monthCursor.year, monthCursor.month);
  const cardById = new Map(lessonCards.map((card) => [card.id, card]));

  const [monthOccurrences, holidayRows] = await Promise.all([
    filteredIds.length === 0
      ? Promise.resolve(
          [] as { id: string; lesson_id: string; occurrence_date: string; status: string }[]
        )
      : Promise.all(
          chunkIds(filteredIds).map((ids) =>
            fetchAllPages<{
              id: string;
              lesson_id: string;
              occurrence_date: string;
              status: string;
            }>((from, to) =>
              supabase
                .from("lesson_occurrences")
                .select("id, lesson_id, occurrence_date, status")
                .in("lesson_id", ids)
                .gte("occurrence_date", monthGrid.rangeStart)
                .lte("occurrence_date", monthGrid.rangeEnd)
                .order("occurrence_date")
                .order("id")
                .range(from, to)
            )
          )
        ).then((pages) => pages.flat()),
    loadHolidayRows(supabase),
  ]);

  const meetingsByDate = new Map<string, CalendarMeeting[]>();
  for (const row of monthOccurrences) {
    const card = cardById.get(row.lesson_id);
    if (!card || !row.id || !row.occurrence_date) continue;
    const status: CalendarMeeting["status"] =
      row.status === "completed" || row.status === "cancelled" ? row.status : "scheduled";
    const list = meetingsByDate.get(row.occurrence_date) ?? [];
    list.push({
      id: row.id,
      date: row.occurrence_date,
      status,
      subject: card.subject,
      teacherName: card.teacherName,
      audienceLabel: card.audienceLabel,
      lessonNumber: card.lesson_number,
      periodCount: card.period_count ?? 1,
    });
    meetingsByDate.set(row.occurrence_date, list);
  }

  const countsByDate: Record<string, number> = {};
  const completeDates: string[] = [];
  const partialDates: string[] = [];
  for (const [date, list] of meetingsByDate) {
    list.sort(
      (a, b) => a.lessonNumber - b.lessonNumber || a.subject.localeCompare(b.subject, "he")
    );
    const active = list.filter((meeting) => meeting.status !== "cancelled");
    if (active.length === 0) continue;
    countsByDate[date] = active.length;
    if (active.every((meeting) => meeting.status === "completed")) completeDates.push(date);
    else partialDates.push(date);
  }

  const dayMeetings = meetingsByDate.get(selectedDate) ?? [];
  const holidaySets = holidayDatesByKind(holidayRows);
  const studyRanges = ((ranges.data ?? []) as { start_date?: string | null; end_date?: string | null }[])
    .filter((range) => range.start_date && range.end_date)
    .map((range) => ({ start_date: range.start_date as string, end_date: range.end_date as string }));

  const identityToTeacherId = new Map(
    (teachers.data ?? []).map((t) => [t.identity_number, t.id])
  );
  const sourcesByTeacher = groupSourceRowsByTeacher(sourceRows, identityToTeacherId);

  const teachersForForm: LessonFormTeacher[] = (teachers.data ?? []).map((t) => ({
    id: t.id,
    full_name: t.full_name,
    salaryAssignments: uniqueSalaryAssignments(
      (sourcesByTeacher.get(t.id) ?? []).map((s) => salaryDisplayFields(s))
    ),
  }));

  const formProps = {
    yearId: activeYear.id,
    teachers: teachersForForm,
    grades: filterFixedGrades(grades.data ?? []),
    classes: classes.data ?? [],
    tracks: tracks.data ?? [],
    specializations: specializations.data ?? [],
    ranges: ranges.data ?? [],
    rules: rules.data ?? [],
    subjects: yearSubjects,
  };

  const filterQuery = new URLSearchParams();
  if (searchParams.classId) filterQuery.set("classId", searchParams.classId);
  if (searchParams.trackId) filterQuery.set("trackId", searchParams.trackId);
  if (searchParams.specializationId) {
    filterQuery.set("specializationId", searchParams.specializationId);
  }
  if (searchParams.teacherId) filterQuery.set("teacherId", searchParams.teacherId);
  if (searchParams.subject) filterQuery.set("subject", searchParams.subject);
  filterQuery.set("date", selectedDate);
  if (searchParams.edit) filterQuery.set("edit", searchParams.edit);

  const editingLesson = searchParams.edit
    ? allLessons.find((l) => l.id === searchParams.edit)
    : undefined;
  const editingAudience = editingLesson
    ? audienceForLesson(editingLesson, audienceByLesson)
    : null;
  const editingTeacherId = editingLesson
    ? one<{ teacher_id: string }>(editingLesson.teacher_teaching_assignments)?.teacher_id ?? ""
    : "";
  const editingSlots = editingLesson
    ? weeklySlotsByLesson.get(editingLesson.id) ??
      slotsFromLessonAndRows(editingLesson, weeklySlotRowsByLesson.get(editingLesson.id))
    : [];
  const editingDraft: LessonFormDraft | null = editingLesson
    ? {
        id: editingLesson.id,
        lessonName: editingLesson.subject,
        subjectName: one<{ name: string }>(editingLesson.subjects)?.name ?? "",
        teacherId: editingTeacherId,
        billingType: editingLesson.billing_type,
        forPsychology: Boolean(editingLesson.for_psychology),
        gradeIds:
          editingAudience && editingAudience.grade_ids.length > 0
            ? editingAudience.grade_ids
            : editingLesson.grade_id
              ? [editingLesson.grade_id]
              : [],
        classIds:
          editingAudience && editingAudience.class_ids.length > 0
            ? editingAudience.class_ids
            : editingLesson.class_id
              ? [editingLesson.class_id]
              : [],
        trackIds:
          editingAudience && editingAudience.track_ids.length > 0
            ? editingAudience.track_ids
            : editingLesson.track_id
              ? [editingLesson.track_id]
              : [],
        specializationIds:
          editingAudience && editingAudience.specialization_ids.length > 0
            ? editingAudience.specialization_ids
            : editingLesson.specialization_id
              ? [editingLesson.specialization_id]
              : [],
        wholeGrade:
          editingLesson.billing_type === "mandatory" &&
          !editingLesson.for_psychology &&
          (editingAudience?.class_ids.length ?? 0) === 0 &&
          (editingAudience?.track_ids.length ?? 0) === 0 &&
          (editingAudience?.specialization_ids.length ?? 0) === 0,
        weeklySlots: editingSlots,
        repeatEveryWeeks:
          editingLesson.repeat_every_weeks === 2 ? 2 : 1,
        dayOfWeek: editingSlots[0]?.dayOfWeek ?? editingLesson.day_of_week,
        lessonNumber: editingSlots[0]?.lessonNumber ?? editingLesson.lesson_number,
        periodCount: editingSlots[0]?.periodCount ?? editingLesson.period_count ?? 1,
        activityRangeId: editingLesson.activity_range_id,
        attendanceRuleId: editingLesson.attendance_rule_id,
      }
    : null;

  const cancelQuery = new URLSearchParams(filterQuery);
  cancelQuery.delete("edit");
  const cancelHref = cancelQuery.toString() ? `/lessons?${cancelQuery.toString()}` : "/lessons";

  const calendarQuery = new URLSearchParams(filterQuery);
  calendarQuery.delete("edit");
  const dateBaseQuery = new URLSearchParams(filterQuery);
  dateBaseQuery.delete("date");

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="שיעורים"
        description="מופעים לפי לוח השנה, ורשימת תבניות השיעור לפי הסינון. יצירת שיעור פותחת את המופעים בטווח שנבחר."
        actions={
          <LessonsFormDialog
            key={searchParams.edit ?? "create"}
            startOpen={Boolean(searchParams.edit)}
            noTeachers={formProps.teachers.length === 0}
            editNotFound={Boolean(searchParams.edit && !editingDraft)}
            editLocked={Boolean(editingLesson && markedByLesson.has(editingLesson.id))}
            markedMeetings={
              editingLesson ? markedByLesson.get(editingLesson.id) ?? [] : []
            }
            {...formProps}
            initial={editingDraft}
            cancelHref={cancelHref}
          />
        }
      />

      <LessonsFilters
        classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        tracks={(tracks.data ?? []).map((t) => ({ id: t.id, name: t.name }))}
        specializations={(specializations.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        teachers={uniqueTeachersByName(teachers.data ?? [])}
        subjects={subjects}
        defaults={{
          classId: searchParams.classId,
          trackId: searchParams.trackId,
          specializationId: searchParams.specializationId,
          teacherId: representativeTeacherId(teachers.data ?? [], searchParams.teacherId),
          subject: searchParams.subject,
        }}
        keepEdit={searchParams.edit}
        keepDate={selectedDate}
      />

      <LessonsByDate
        selectedDate={selectedDate}
        baseQuery={dateBaseQuery.toString()}
        meetings={dayMeetings}
        countsByDate={countsByDate}
        completeDates={completeDates}
        partialDates={partialDates}
        holidayDates={holidaySets.vacation}
        cancelledDates={holidaySets.cancelled}
        studyRanges={studyRanges}
      />

      <LessonsCalendar
        lessons={lessonCards}
        monthQuery={calendarQuery.toString()}
        students={yearStudents}
        editingId={editingDraft?.id}
      />

      <AttendancePoolsPanel
        yearId={activeYear.id}
        pools={poolViews}
        lessons={poolLessonOptions}
      />
    </div>
  );
}
