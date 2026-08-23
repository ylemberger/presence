"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction, createLessonForDateAction } from "../actions";
import { isoToHDate } from "@/lib/dates/hebrew";
import { describeAudienceScope } from "@/lib/validation";
import type { ActivityRange, AttendanceRule, Teacher } from "@/types/database";

export interface LessonsFormProps {
  yearId: string;
  occurrenceDate?: string;
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
  occurrenceDate,
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
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">("mandatory");
  const [forPsychology, setForPsychology] = useState(false);
  const [gradeId, setGradeId] = useState("");
  const [classId, setClassId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [specializationId, setSpecializationId] = useState("");

  const defaultDay =
    occurrenceDate != null ? String(isoToHDate(occurrenceDate).getDay()) : undefined;

  const filteredClasses = useMemo(
    () => classes.filter((c) => !gradeId || c.grade_id === gradeId),
    [classes, gradeId]
  );

  const gradeName = grades.find((g) => g.id === gradeId)?.name;
  const className = classes.find((c) => c.id === classId)?.name;
  const trackName = tracks.find((t) => t.id === trackId)?.name;
  const specializationName = specializations.find((s) => s.id === specializationId)?.name;

  const audienceSummary = describeAudienceScope({
    billing_type: billingType,
    gradeName,
    className,
    trackName,
    specializationName,
    forPsychology,
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
        fd.set("specialization_id", "");
        fd.set("class_id", classId);
        fd.set("track_id", trackId);
      }
      if (occurrenceDate) fd.set("occurrence_date", occurrenceDate);

      const result = occurrenceDate
        ? await createLessonForDateAction(fd)
        : await createLessonAction(fd);

      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }

      form.reset();
      setBillingType("mandatory");
      setForPsychology(false);
      setGradeId("");
      setClassId("");
      setTrackId("");
      setSpecializationId("");
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">מורה ומקצוע</p>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="מורה"
            name="teacher_id"
            required
            options={[
              { value: "", label: "בחרי מורה" },
              ...teachers.map((t) => ({ value: t.id, label: t.full_name })),
            ]}
          />
          <Input label="מקצוע" name="subject" required />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">קהל יעד</p>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setClassId("");
            }}
            options={[
              { value: "", label: "בחרי שכבה" },
              ...grades.map((g) => ({ value: g.id, label: g.name })),
            ]}
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
            <Select
              label="התמחות"
              name="specialization_id"
              required
              value={specializationId}
              onChange={(e) => setSpecializationId(e.target.value)}
              options={[
                { value: "", label: "בחרי התמחות" },
                ...specializations.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          ) : (
            <>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={forPsychology}
                  onChange={(e) => {
                    setForPsychology(e.target.checked);
                    if (e.target.checked) {
                      setClassId("");
                      setTrackId("");
                    }
                  }}
                  className="rounded border-stone-300"
                />
                מיועד לפסיכולוגיה
              </label>
              {!forPsychology && (
                <>
                  <Select
                    label="כיתה"
                    name="class_id"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    options={[
                      { value: "", label: "ללא (כל הכיתות בשכבה)" },
                      ...filteredClasses.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <Select
                    label="מסלול"
                    name="track_id"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    options={[
                      { value: "", label: "ללא (כל המסלולים)" },
                      ...tracks.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </>
              )}
            </>
          )}
        </div>
        <p className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-xs text-slate-600">
          {forPsychology
            ? "ישויכו רק תלמידות המסומנות כפסיכולוגיה בשכבה זו."
            : billingType === "specialization"
              ? "ישויכו תלמידות עם ההתמחות בשכבה שנבחרה."
              : classId && trackId
                ? "נבחרו כיתה ומסלול — ישויכו רק תלמידות בשניהם."
                : classId
                  ? "נבחרה כיתה — כל תלמידות הכיתה."
                  : trackId
                    ? "נבחר מסלול — כל תלמידות המסלול בשכבה."
                    : "בחובה: בחרי כיתה או מסלול (או שניהם), או סמני פסיכולוגיה."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">לוח זמנים ונוכחות</p>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="יום בשבוע"
            name="day_of_week"
            required
            defaultValue={defaultDay}
            options={DAY_OF_WEEK_LABELS.map((l, i) => ({ value: String(i), label: l }))}
          />
          <Input
            label="מספר שיעור (1-9)"
            name="lesson_number"
            type="number"
            min={1}
            max={9}
            required
          />
          <Select
            label="טווח פעילות"
            name="activity_range_id"
            required
            options={[
              { value: "", label: "בחרי טווח" },
              ...ranges.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <Select
            label="כלל נוכחות"
            name="attendance_rule_id"
            required
            options={[
              { value: "", label: "בחרי" },
              ...rules.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.max_allowed_absence_percent}%)`,
              })),
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {occurrenceDate
            ? "ייווצרו כל מופעי השיעור בטווח הפעילות לפי היום שנבחר."
            : "ייווצרו אוטומטית כל מופעי השיעור בטווח הפעילות."}
        </p>
      </div>

      {gradeId && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2 text-xs text-teal-950">
          <div className="font-semibold text-teal-900">סיכום</div>
          <div className="mt-1 text-teal-800/90">קהל: {audienceSummary}</div>
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "יוצר שיעור..." : "יצירת שיעור"}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
