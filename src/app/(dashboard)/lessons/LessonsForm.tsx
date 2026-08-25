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
import type { ActivityRange, AttendanceRule, Teacher } from "@/types/database";
import { Icon } from "@/components/ui/Icon";
import { MultiSelect } from "@/components/ui/MultiSelect";

export interface LessonsFormProps {
  yearId: string;
  teachers: Pick<Teacher, "id" | "full_name">[];
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
  const [gradeId, setGradeId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [specializationIds, setSpecializationIds] = useState<string[]>([]);
  const [wholeGrade, setWholeGrade] = useState(false);
  const [lessonNumber, setLessonNumber] = useState("1");
  const [periodCount, setPeriodCount] = useState("1");

  const filteredClasses = useMemo(
    () => classes.filter((c) => !gradeId || c.grade_id === gradeId),
    [classes, gradeId]
  );

  const gradeName = grades.find((g) => g.id === gradeId)?.name;
  const classNames = classes.filter((c) => classIds.includes(c.id)).map((c) => c.name);
  const trackNames = tracks.filter((t) => trackIds.includes(t.id)).map((t) => t.name);
  const specializationNames = specializations
    .filter((s) => specializationIds.includes(s.id))
    .map((s) => s.name);

  const audienceSummary = describeAudienceScope({
    billing_type: billingType,
    gradeName,
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
      if (gradeId) fd.set("grade_id", gradeId);
      if (!gradeId) {
        setError("יש לבחור שכבה");
        setLoading(false);
        return;
      }
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
      setGradeId("");
      setClassIds([]);
      setTrackIds([]);
      setSpecializationIds([]);
      setWholeGrade(false);
      setLessonNumber("1");
      setPeriodCount("1");
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
    <form key={formEpoch} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <p className="mb-2 font-label-md text-label-md text-primary">מורה ומקצוע</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Combobox
            label="מורה"
            name="teacher_id"
            required
            options={teachers.map((t) => ({ value: t.id, label: t.full_name }))}
            emptyLabel="בחרי מורה"
          />
          <Input label="מקצוע" name="subject" required />
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md text-primary">קהל יעד</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Combobox
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setClassIds([]);
            }}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="בחרי שכבה"
          />
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
            <div className="sm:col-span-2">
              <MultiSelect
                label="התמחויות"
                name="specialization_ids"
                values={specializationIds}
                onChange={setSpecializationIds}
                options={specializations.map((s) => ({ value: s.id, label: s.name }))}
                hint="אפשר כמה. תלמידה תשויך אם יש לה אחת מהן (ראשית או נוספת)."
              />
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface sm:col-span-2">
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
                  <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface sm:col-span-2">
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
                    כל השכבה
                  </label>
                  {!wholeGrade && (
                    <>
                      <MultiSelect
                        label="כיתות"
                        name="class_ids"
                        values={classIds}
                        onChange={setClassIds}
                        options={filteredClasses.map((c) => ({ value: c.id, label: c.name }))}
                        hint="בחירה מרובה — מי שבאחת הכיתות."
                      />
                      <MultiSelect
                        label="מסלולים"
                        name="track_ids"
                        values={trackIds}
                        onChange={setTrackIds}
                        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
                        hint="בחירה מרובה — מי שבאחד המסלולים."
                      />
                      <div className="sm:col-span-2">
                        <MultiSelect
                          label="התמחויות (רשות)"
                          name="specialization_ids"
                          values={specializationIds}
                          onChange={setSpecializationIds}
                          options={specializations.map((s) => ({ value: s.id, label: s.name }))}
                          hint="גם כאן: מי שיש לה אחת מההתמחויות האלה תשויך."
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
            ? "ישויכו רק תלמידות המסומנות כפסיכולוגיה בשכבה זו."
            : billingType === "specialization"
              ? "ישויכו תלמידות בשכבה עם אחת מההתמחויות שנבחרו."
              : wholeGrade || (classIds.length === 0 && trackIds.length === 0 && specializationIds.length === 0)
                ? "כל תלמידות השכבה ישויכו."
                : "תלמידה תשויך אם היא באחת הכיתות, או באחד המסלולים, או באחת ההתמחויות שנבחרו."}
        </p>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md text-primary">לוח זמנים ונוכחות</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      {gradeId && (
        <div className="rounded-lg border border-secondary/20 bg-secondary-container/40 px-3 py-2 font-body-sm text-body-sm text-primary">
          <div className="font-semibold">סיכום</div>
          <div className="mt-1 text-on-surface-variant">קהל: {audienceSummary}</div>
          <div className="mt-1 text-on-surface-variant">
            שעות: {formatLessonHours(Number(lessonNumber) || 1, Number(periodCount) || 1)}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="mt-1 w-full">
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
