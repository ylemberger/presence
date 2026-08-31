"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction } from "../actions";
import { describeAudienceScope } from "@/lib/validation";
import { formatLessonHours } from "@/lib/lessons/hours";
import {
  formatSalaryAssignment,
  salarySearchKeywords,
  type SalaryDisplayFields,
} from "@/lib/teachers/salary-display";
import type { ActivityRange, AttendanceRule } from "@/types/database";
import { Icon } from "@/components/ui/Icon";
import { MultiSelect } from "@/components/ui/MultiSelect";

export type LessonFormTeacher = {
  id: string;
  full_name: string;
  salaryAssignments: SalaryDisplayFields[];
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
  onCreated?: () => void;
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
  onCreated,
}: LessonsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">("mandatory");
  const [forPsychology, setForPsychology] = useState(false);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [specializationIds, setSpecializationIds] = useState<string[]>([]);
  const [wholeGrade, setWholeGrade] = useState(false);
  const [lessonNumber, setLessonNumber] = useState("1");
  const [periodCount, setPeriodCount] = useState("1");
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");

  const filteredClasses = useMemo(
    () =>
      gradeIds.length === 0
        ? classes
        : classes.filter((c) => gradeIds.includes(c.grade_id)),
    [classes, gradeIds]
  );

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === teacherId) ?? null,
    [teachers, teacherId]
  );
  const teacherSalary = selectedTeacher?.salaryAssignments ?? [];

  function applyTeacher(nextId: string) {
    setTeacherId(nextId);
    const next = teachers.find((t) => t.id === nextId);
    const subjects = [
      ...new Set(
        (next?.salaryAssignments ?? [])
          .map((a) => a.subject?.trim())
          .filter((v): v is string => Boolean(v))
      ),
    ];
    if (subjects.length === 1) setSubject(subjects[0]);
  }

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

      const result = await createLessonAction(fd);

      if (result && "error" in result && result.error) {
        setError(result.error);
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
      setTeacherId("");
      setSubject("");
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
    <form key={formEpoch} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="mb-2 font-label-md text-label-md text-primary">מורה ומקצוע</p>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-4">
            <Combobox
              label="מורה"
              name="teacher_id"
              required
              value={teacherId}
              onChange={applyTeacher}
              options={teachers.map((t) => ({
                value: t.id,
                label: t.full_name,
                description:
                  t.salaryAssignments.length > 0
                    ? [
                        ...new Set(
                          t.salaryAssignments
                            .map((a) => a.subject)
                            .filter((v): v is string => Boolean(v))
                        ),
                      ].join(" · ")
                    : "אין שיבוצי שכר",
                keywords: salarySearchKeywords(t.salaryAssignments),
              }))}
              emptyLabel="בחרי מורה"
            />
            <Input
              label="מקצוע"
              name="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="min-w-0 lg:col-span-8">
            <p className="mb-1.5 font-label-md text-label-md text-on-surface">
              שיבוצי שכר של המורה
            </p>
            {!teacherId ? (
              <p className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-3 py-3 font-caption text-caption text-on-surface-variant">
                בחרי מורה — יוצגו כאן המקצוע, המסלול, השנה, הסמסטר ומספר המפגשים ממערכת השכר.
              </p>
            ) : teacherSalary.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/60 px-3 py-3 font-caption text-caption text-on-surface-variant">
                אין שיבוצי שכר מיובאים למורה זו.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto overflow-x-hidden rounded-lg border border-outline-variant/40">
                <table className="w-full table-fixed text-right">
                  <thead>
                    <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant">
                      {["מקצוע בסיס", "מסלול", "שנה", "סמסטר", "מפגשים", ""].map((h) => (
                        <th
                          key={h || "action"}
                          className="px-2 py-1.5 font-caption text-caption font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teacherSalary.map((row, i) => (
                      <tr
                        key={`${row.subject}-${row.track}-${row.year}-${row.semester}-${i}`}
                        className="border-b border-outline-variant/20 last:border-0"
                      >
                        <td className="break-words px-2 py-1.5 font-caption text-caption font-medium text-primary">
                          {row.subject || "—"}
                        </td>
                        <td className="break-words px-2 py-1.5 font-caption text-caption text-on-surface-variant">
                          {row.track || "—"}
                        </td>
                        <td className="break-words px-2 py-1.5 font-caption text-caption text-on-surface-variant">
                          {row.year || "—"}
                        </td>
                        <td className="break-words px-2 py-1.5 font-caption text-caption text-on-surface-variant">
                          {row.semester || "—"}
                        </td>
                        <td className="px-2 py-1.5 font-caption text-caption text-on-surface-variant">
                          {row.meetings ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.subject ? (
                            <button
                              type="button"
                              className="whitespace-nowrap font-caption text-caption text-secondary hover:underline"
                              title={formatSalaryAssignment(row)}
                              onClick={() => setSubject(row.subject ?? "")}
                            >
                              למקצוע
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md text-primary">קהל יעד</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2 xl:col-span-4">
            <MultiSelect
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
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface sm:col-span-2 xl:col-span-4">
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
                  className="rounded border-outline-variant"
                />
                מיועד לפסיכולוגיה
              </label>
              {!forPsychology && (
                <>
                  <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface sm:col-span-2 xl:col-span-4">
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
                      className="rounded border-outline-variant"
                    />
                    כל השכבות שנבחרו
                  </label>
                  {!wholeGrade && (
                    <>
                      <MultiSelect
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
                        label="מסלולים"
                        name="track_ids"
                        values={trackIds}
                        onChange={setTrackIds}
                        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
                        hint="אופציונלי. אם נבחר — חייבת להיות באחד המסלולים."
                      />
                      <div className="sm:col-span-2 xl:col-span-2">
                        <MultiSelect
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
        <p className="mt-2 rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
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
        <p className="mb-2 font-label-md text-label-md text-primary">לוח זמנים ונוכחות</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            label="יום בשבוע"
            name="day_of_week"
            required
            options={DAY_OF_WEEK_LABELS.map((l, i) => ({ value: String(i), label: l }))}
          />
          <Select
            label="שעת התחלה"
            name="lesson_number"
            required
            value={lessonNumber}
            onChange={(e) => setLessonNumber(e.target.value)}
            options={Array.from({ length: 9 }, (_, i) => ({
              value: String(i + 1),
              label: `שיעור ${i + 1}`,
            }))}
          />
          <Select
            label="מספר שעות רצופות"
            name="period_count"
            required
            value={periodCount}
            onChange={(e) => setPeriodCount(e.target.value)}
            options={Array.from({ length: 9 }, (_, i) => ({
              value: String(i + 1),
              label: i === 0 ? "שעה אחת" : `${i + 1} שעות`,
            }))}
          />
          <Combobox
            label="טווח פעילות"
            name="activity_range_id"
            required
            options={ranges.map((r) => ({ value: r.id, label: r.name }))}
            emptyLabel="בחרי טווח"
          />
          <Combobox
            label="כלל נוכחות"
            name="attendance_rule_id"
            required
            options={rules.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.max_allowed_absence_percent}%)`,
            }))}
            emptyLabel="בחרי כלל"
          />
        </div>
        <p className="mt-2 font-caption text-caption text-on-surface-variant">
          שיעור של שעתיים רצופות: שעת התחלה 1 ומשך 2 ({formatLessonHours(1, 2)}). ימי חופשה
          מגדירים ב־הגדרות ← לשונית «לוח חופשות».
        </p>
      </div>

      {gradeIds.length > 0 && (
        <div className="rounded-lg border border-secondary/20 bg-secondary-container/40 px-3 py-2 font-body-sm text-body-sm text-primary">
          <div className="font-semibold">סיכום</div>
          <div className="mt-1 text-on-surface-variant">קהל: {audienceSummary}</div>
          <div className="mt-1 text-on-surface-variant">
            שעות: {formatLessonHours(Number(lessonNumber) || 1, Number(periodCount) || 1)}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="mt-1 w-full sm:w-auto">
        <Icon name="save" className="text-[18px]" />
        {loading ? "יוצר שיעור ומופעים..." : "שמור שיעור"}
      </Button>

      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </form>
  );
}
