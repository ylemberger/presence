"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction, updateLessonAction } from "../actions";
import { describeAudienceScope } from "@/lib/validation";
import { formatLessonHours, MAX_LESSON_NUMBER } from "@/lib/lessons/hours";
import {
  formatSalaryAssignment,
  salaryAssignmentEntries,
  salarySearchKeywords,
  type SalaryDisplayFields,
} from "@/lib/teachers/salary-display";
import type { ActivityRange, AttendanceRule } from "@/types/database";
import { Icon } from "@/components/ui/Icon";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { HebrewDateRangePicker } from "@/components/ui/HebrewDateRangePicker";
import {
  FLEXIBLE_RANGE_FORM_VALUE,
  isFlexibleActivityRange,
} from "@/lib/lessons/flexible-range";

export type LessonFormTeacher = {
  id: string;
  full_name: string;
  salaryAssignments: SalaryDisplayFields[];
};

export type LessonFormDraft = {
  id: string;
  lessonName: string;
  subjectName: string;
  teacherId: string;
  billingType: "mandatory" | "specialization";
  forPsychology: boolean;
  gradeIds: string[];
  classIds: string[];
  trackIds: string[];
  specializationIds: string[];
  wholeGrade: boolean;
  dayOfWeek: number;
  lessonNumber: number;
  periodCount: number;
  activityRangeId: string;
  attendanceRuleId: string;
};

export interface LessonsFormProps {
  yearId: string;
  teachers: LessonFormTeacher[];
  grades: { id: string; name: string }[];
  classes: { id: string; name: string; grade_id: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  ranges: ActivityRange[];
  rules: AttendanceRule[];
  subjects: { id: string; name: string }[];
  initial?: LessonFormDraft | null;
  cancelHref?: string;
  onCreated?: () => void;
  onCancel?: () => void;
}

export function LessonsForm({
  yearId,
  teachers,
  grades,
  classes,
  tracks,
  specializations,
  ranges,
  rules,
  subjects,
  initial,
  cancelHref,
  onCreated,
  onCancel,
}: LessonsFormProps) {
  const editing = Boolean(initial?.id);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">(
    initial?.billingType ?? "mandatory"
  );
  const [forPsychology, setForPsychology] = useState(initial?.forPsychology ?? false);
  const [gradeIds, setGradeIds] = useState<string[]>(initial?.gradeIds ?? []);
  const [classIds, setClassIds] = useState<string[]>(initial?.classIds ?? []);
  const [trackIds, setTrackIds] = useState<string[]>(initial?.trackIds ?? []);
  const [specializationIds, setSpecializationIds] = useState<string[]>(
    initial?.specializationIds ?? []
  );
  const [wholeGrade, setWholeGrade] = useState(initial?.wholeGrade ?? false);
  const [lessonNumber, setLessonNumber] = useState(String(initial?.lessonNumber ?? 1));
  const [periodCount, setPeriodCount] = useState(String(initial?.periodCount ?? 1));
  const [assignmentKey, setAssignmentKey] = useState(() => {
    if (!initial?.teacherId) return "";
    const teacher = teachers.find((t) => t.id === initial.teacherId);
    if (teacher && teacher.salaryAssignments.length > 0) return `${initial.teacherId}::0`;
    return `${initial.teacherId}::`;
  });
  const [subjectName, setSubjectName] = useState(initial?.subjectName ?? "");
  const skipSalarySubject = useRef(Boolean(initial));
  const subjectListId = useId();
  const initialRange = ranges.find((r) => r.id === initial?.activityRangeId);
  const [rangeChoice, setRangeChoice] = useState(() =>
    isFlexibleActivityRange(initialRange)
      ? FLEXIBLE_RANGE_FORM_VALUE
      : (initial?.activityRangeId ?? "")
  );
  const namedRanges = useMemo(
    () => ranges.filter((r) => !isFlexibleActivityRange(r)),
    [ranges]
  );
  const flexibleDefaults = isFlexibleActivityRange(initialRange)
    ? { start: initialRange?.start_date, end: initialRange?.end_date }
    : { start: undefined, end: undefined };

  const filteredClasses = useMemo(
    () =>
      gradeIds.length === 0
        ? classes
        : classes.filter((c) => gradeIds.includes(c.grade_id)),
    [classes, gradeIds]
  );

  const assignmentOptions = useMemo(
    () =>
      teachers.flatMap((t) => {
        if (t.salaryAssignments.length === 0) {
          return [
            {
              value: `${t.id}::`,
              label: t.full_name,
              description: "אין שיבוצי שכר",
              keywords: t.full_name,
            },
          ];
        }
        return t.salaryAssignments.map((a, i) => ({
          value: `${t.id}::${i}`,
          label: t.full_name,
          description: formatSalaryAssignment(a),
          selectedLabel: a.subject ? `${t.full_name} · ${a.subject}` : t.full_name,
          keywords: `${t.full_name} ${salarySearchKeywords([a])}`,
        }));
      }),
    [teachers]
  );

  const picked = useMemo(() => {
    if (!assignmentKey) return null;
    const sep = assignmentKey.indexOf("::");
    if (sep < 0) return null;
    const teacherId = assignmentKey.slice(0, sep);
    const indexRaw = assignmentKey.slice(sep + 2);
    const teacher = teachers.find((t) => t.id === teacherId) ?? null;
    if (!teacher) return null;
    const index = indexRaw === "" ? null : Number(indexRaw);
    const selectedAssignment =
      index != null && Number.isFinite(index) ? (teacher.salaryAssignments[index] ?? null) : null;
    return { teacher, teacherId, index, selectedAssignment };
  }, [assignmentKey, teachers]);

  const teacherId = picked?.teacherId ?? "";
  const teacherSalary = picked?.teacher.salaryAssignments ?? [];
  const selectedAssignment = picked?.selectedAssignment ?? null;

  useEffect(() => {
    if (skipSalarySubject.current) {
      skipSalarySubject.current = false;
      return;
    }
    const fromSalary = selectedAssignment?.subject?.trim() ?? "";
    if (fromSalary) setSubjectName(fromSalary);
  }, [assignmentKey, selectedAssignment?.subject]);

  const gradeNames = grades.filter((g) => gradeIds.includes(g.id)).map((g) => g.name);
  const classNames = classes.filter((c) => classIds.includes(c.id)).map((c) => c.name);
  const trackNames = tracks.filter((t) => trackIds.includes(t.id)).map((t) => t.name);
  const specializationNames = specializations
    .filter((s) => specializationIds.includes(s.id))
    .map((s) => s.name);

  const audienceSummary = describeAudienceScope({
    billing_type: billingType,
    gradeNames,
    classNames,
    trackNames,
    specializationNames,
    forPsychology,
    wholeGrade,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      fd.set("billing_type", billingType);
      if (!teacherId) {
        setError("יש לבחור מורה ושיבוץ");
        setLoading(false);
        return;
      }
      if (gradeIds.length === 0) {
        setError("יש לבחור לפחות שכבה אחת");
        setLoading(false);
        return;
      }
      fd.set("grade_id", gradeIds[0]);
      if (wholeGrade) fd.set("whole_grade", "1");
      if (billingType === "specialization") {
        fd.set("class_id", "");
        fd.set("track_id", "");
        fd.set("for_psychology", "");
      } else if (forPsychology) {
        fd.set("for_psychology", "1");
        fd.set("class_id", "");
        fd.set("track_id", "");
        fd.set("specialization_id", "");
      } else {
        fd.set("for_psychology", "");
      }

      if (editing) fd.set("lesson_id", initial!.id);
      const result = editing ? await updateLessonAction(fd) : await createLessonAction(fd);

      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }

      if (editing) {
        if (cancelHref) router.push(cancelHref);
        else router.refresh();
        onCreated?.();
        return;
      }

      form.reset();
      setBillingType("mandatory");
      setForPsychology(false);
      setGradeIds([]);
      setClassIds([]);
      setTrackIds([]);
      setSpecializationIds([]);
      setWholeGrade(false);
      setLessonNumber("1");
      setPeriodCount("1");
      setAssignmentKey("");
      setSubjectName("");
      setRangeChoice("");
      setFormEpoch((n) => n + 1);
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form key={`${initial?.id ?? "new"}-${formEpoch}`} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <p className="mb-3 font-headline-md text-headline-md text-primary">מורה ושיעור</p>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            {editing ? <input type="hidden" name="lesson_id" value={initial!.id} /> : null}
            <input type="hidden" name="teacher_id" value={teacherId} />
            <Combobox
              fieldSize="lg"
              label="מורה ושיבוץ שכר"
              value={assignmentKey}
              onChange={setAssignmentKey}
              options={assignmentOptions}
              emptyLabel="בחרי מורה ושיבוץ"
              placeholder="הקלידי שם מורה, מקצוע או מסלול…"
              maxSuggestions={40}
            />
            <Input
              fieldSize="lg"
              label="שם מקצוע"
              name="subject_name"
              required
              list={subjectListId}
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="למשל בישול"
            />
            <datalist id={subjectListId}>
              {subjects.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <Input
              fieldSize="lg"
              label="שם השיעור"
              name="lesson_name"
              required
              defaultValue={initial?.lessonName ?? ""}
              placeholder="למשל בישול — קבוצה א"
            />
            <p className="font-body-md text-body-md text-on-surface-variant">
              כל שיעור נספר לבד בנוכחות, גם אם יש כמה שיעורים באותו שם. קיבוץ לנוכחות אחת נעשה ידנית ביומן השיעורים.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-7">
            {!picked ? (
              <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-4 py-5">
                <p className="font-title-lg text-title-lg text-on-surface">שיבוץ נבחר</p>
                <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                  בחרי מורה ואת השיבוץ הספציפי שלה. הפרטים יופיעו כאן בצד, כדי לעזור למלא את
                  השיעור.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-secondary/30 bg-secondary-container/40 p-4">
                  <p className="font-title-lg text-title-lg text-primary">
                    השיבוץ שנבחר · {picked.teacher.full_name}
                  </p>
                  {selectedAssignment ? (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {salaryAssignmentEntries(selectedAssignment).map((item) => (
                        <div key={item.label} className="min-w-0">
                          <dt className="font-body-md text-body-md text-on-surface-variant">
                            {item.label}
                          </dt>
                          <dd className="break-words font-body-lg text-body-lg text-on-surface">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                      אין שיבוצי שכר מיובאים למורה זו.
                    </p>
                  )}
                </div>
                {teacherSalary.length > 1 && (
                  <div>
                    <p className="mb-2 font-body-md text-body-md text-on-surface-variant">
                      כל השיבוצים של {picked.teacher.full_name} — לחצי כדי לבחור שיבוץ אחר
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {teacherSalary.map((row, i) => {
                        const active = picked.index === i;
                        return (
                          <li key={`${row.subject}-${row.track}-${i}`}>
                            <button
                              type="button"
                              onClick={() => setAssignmentKey(`${picked.teacherId}::${i}`)}
                              className={
                                active
                                  ? "w-full rounded-md border border-secondary bg-secondary-container/50 px-4 py-3 text-right"
                                  : "w-full rounded-md border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-right hover:border-secondary/40"
                              }
                            >
                              <span className="block font-title-lg text-title-lg text-primary">
                                {row.subject || "שיבוץ"}
                                {active ? " · נבחר" : ""}
                              </span>
                              <span className="mt-1 block break-words font-body-md text-body-md text-on-surface-variant">
                                {formatSalaryAssignment(row)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 font-headline-md text-headline-md text-primary">קהל יעד</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2 xl:col-span-4">
            <MultiSelect
              fieldSize="lg"
              label="שכבות"
              name="grade_ids"
              values={gradeIds}
              onChange={(next) => {
                setGradeIds(next);
                setClassIds((prev) =>
                  prev.filter((id) => {
                    const cls = classes.find((c) => c.id === id);
                    return cls ? next.includes(cls.grade_id) : false;
                  })
                );
              }}
              options={grades.map((g) => ({ value: g.id, label: g.name }))}
              hint="אפשר כמה שכבות. תלמידה תשויך אם היא באחת מהן (ובנוסף עומדת בשאר התנאים)."
            />
          </div>
          <Select
            fieldSize="lg"
            label="סוג שיעור"
            name="billing_type_ui"
            required
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "mandatory" | "specialization")}
            options={Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          {billingType === "specialization" ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <MultiSelect
                fieldSize="lg"
                label="התמחויות"
                name="specialization_ids"
                values={specializationIds}
                onChange={setSpecializationIds}
                options={specializations.map((s) => ({ value: s.id, label: s.name }))}
                hint="תלמידה תשויך אם היא באחת השכבות שנבחרו וגם יש לה אחת מההתמחויות (ראשית או נוספת)."
              />
            </div>
          ) : (
            <>
              <label className="flex items-center gap-3 font-title-lg text-title-lg text-on-surface sm:col-span-2 xl:col-span-4">
                <input
                  type="checkbox"
                  checked={forPsychology}
                  onChange={(e) => {
                    setForPsychology(e.target.checked);
                    if (e.target.checked) {
                      setClassIds([]);
                      setTrackIds([]);
                      setSpecializationIds([]);
                      setWholeGrade(false);
                    }
                  }}
                  className="h-5 w-5 rounded border-outline-variant"
                />
                מיועד לפסיכולוגיה
              </label>
              {!forPsychology && (
                <>
                  <label className="flex items-center gap-3 font-title-lg text-title-lg text-on-surface sm:col-span-2 xl:col-span-4">
                    <input
                      type="checkbox"
                      checked={wholeGrade}
                      onChange={(e) => {
                        setWholeGrade(e.target.checked);
                        if (e.target.checked) {
                          setClassIds([]);
                          setTrackIds([]);
                          setSpecializationIds([]);
                        }
                      }}
                      className="h-5 w-5 rounded border-outline-variant"
                    />
                    כל השכבות שנבחרו
                  </label>
                  {!wholeGrade && (
                    <>
                      <MultiSelect
                        fieldSize="lg"
                        label="כיתות"
                        name="class_ids"
                        values={classIds}
                        onChange={setClassIds}
                        options={filteredClasses.map((c) => {
                          const gName = grades.find((g) => g.id === c.grade_id)?.name;
                          return {
                            value: c.id,
                            label: gradeIds.length > 1 && gName ? `${gName} · ${c.name}` : c.name,
                          };
                        })}
                        hint="אופציונלי. אם נבחר — חייבת להיות באחת הכיתות."
                      />
                      <MultiSelect
                        fieldSize="lg"
                        label="מסלולים"
                        name="track_ids"
                        values={trackIds}
                        onChange={setTrackIds}
                        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
                        hint="אופציונלי. אם נבחר — חייבת להיות באחד המסלולים."
                      />
                      <div className="sm:col-span-2 xl:col-span-2">
                        <MultiSelect
                          fieldSize="lg"
                          label="התמחויות (רשות)"
                          name="specialization_ids"
                          values={specializationIds}
                          onChange={setSpecializationIds}
                          options={specializations.map((s) => ({ value: s.id, label: s.name }))}
                          hint="אופציונלי. אם נבחר — חייבת להיות עם אחת מההתמחויות."
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <p className="mt-3 rounded-lg bg-surface-container-low px-4 py-3 font-body-md text-body-md text-on-surface-variant">
          {forPsychology
            ? "ישויכו תלמידות המסומנות כפסיכולוגיה באחת השכבות שנבחרו."
            : billingType === "specialization"
              ? "ישויכו תלמידות שבאחת השכבות וגם עם אחת מההתמחויות שנבחרו."
              : wholeGrade ||
                  (classIds.length === 0 && trackIds.length === 0 && specializationIds.length === 0)
                ? "כל תלמידות השכבות שנבחרו ישויכו."
                : "תלמידה תשויך אם היא באחת השכבות, וגם עומדת בכל שאר התנאים שנבחרו (כיתה / מסלול / התמחות)."}
        </p>
      </div>

      <div>
        <p className="mb-3 font-headline-md text-headline-md text-primary">לוח זמנים ונוכחות</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            fieldSize="lg"
            label="יום בשבוע"
            name="day_of_week"
            required
            defaultValue={String(initial?.dayOfWeek ?? 0)}
            options={DAY_OF_WEEK_LABELS.map((l, i) => ({ value: String(i), label: l }))}
          />
          <Select
            fieldSize="lg"
            label="שעת התחלה"
            name="lesson_number"
            required
            value={lessonNumber}
            onChange={(e) => setLessonNumber(e.target.value)}
            options={Array.from({ length: MAX_LESSON_NUMBER }, (_, i) => ({
              value: String(i + 1),
              label: `שיעור ${i + 1}`,
            }))}
          />
          <Select
            fieldSize="lg"
            label="מספר שעות רצופות"
            name="period_count"
            required
            value={periodCount}
            onChange={(e) => setPeriodCount(e.target.value)}
            options={Array.from({ length: MAX_LESSON_NUMBER }, (_, i) => ({
              value: String(i + 1),
              label: i === 0 ? "שעה אחת" : `${i + 1} שעות`,
            }))}
          />
          <Combobox
            fieldSize="lg"
            label="טווח פעילות"
            name="activity_range_id"
            required
            value={rangeChoice}
            onChange={setRangeChoice}
            maxSuggestions={Math.max(12, namedRanges.length + 1)}
            options={[
              {
                value: FLEXIBLE_RANGE_FORM_VALUE,
                label: "גמישה",
                description: "בחירת טווח תאריכים בלוח",
              },
              ...namedRanges.map((r) => ({ value: r.id, label: r.name })),
            ]}
            emptyLabel="בחרי טווח"
          />
          <Combobox
            fieldSize="lg"
            label="כלל נוכחות"
            name="attendance_rule_id"
            required
            defaultValue={initial?.attendanceRuleId ?? ""}
            options={rules.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.max_allowed_absence_percent}%)`,
            }))}
            emptyLabel="בחרי כלל"
          />
        </div>
        {rangeChoice === FLEXIBLE_RANGE_FORM_VALUE && (
          <div className="mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-low/60 p-4">
            <p className="mb-3 font-label-md text-label-md text-primary">טווח גמיש</p>
            <p className="mb-3 font-caption text-caption text-on-surface-variant">
              בחרי בלוח תאריך התחלה ואז תאריך סיום. ליום אחד — לחצי פעמיים על אותו תאריך,
              או «יום אחד בלבד».
            </p>
            <HebrewDateRangePicker
              key={`${formEpoch}-${flexibleDefaults.start ?? ""}-${flexibleDefaults.end ?? ""}`}
              startName="flexible_start_date"
              endName="flexible_end_date"
              defaultStart={flexibleDefaults.start}
              defaultEnd={flexibleDefaults.end}
              required
            />
          </div>
        )}
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
          שיעור של שעתיים רצופות: שעת התחלה 1 ומשך 2 ({formatLessonHours(1, 2)}). ימי חופשה
          מגדירים ב־הגדרות ← לשונית «לוח חופשות».
        </p>
      </div>

      {gradeIds.length > 0 && (
        <div className="rounded-lg border border-secondary/20 bg-secondary-container/40 px-4 py-3 font-body-lg text-body-lg text-primary">
          <div className="font-semibold">סיכום</div>
          <div className="mt-1 text-on-surface-variant">קהל: {audienceSummary}</div>
          <div className="mt-1 text-on-surface-variant">
            שעות: {formatLessonHours(Number(lessonNumber) || 1, Number(periodCount) || 1)}
          </div>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
          <Icon name="save" className="text-[22px]" />
          {loading
            ? editing
              ? "שומר שיעור..."
              : "יוצר שיעור ומופעים..."
            : editing
              ? "שמור שינויים"
              : "שמור שיעור"}
        </Button>
        {editing && cancelHref ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              router.push(cancelHref);
              onCancel?.();
            }}
          >
            ביטול עריכה
          </Button>
        ) : onCancel ? (
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            ביטול
          </Button>
        ) : null}
      </div>

      {error && (
        <p className="rounded-lg bg-error-container/60 px-4 py-3 font-body-lg text-body-lg text-on-error-container">
          {error}
        </p>
      )}
    </form>
  );
}
