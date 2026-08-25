"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction } from "../actions";
import { describeAudienceScope } from "@/lib/validation";
import type { ActivityRange, AttendanceRule, Teacher } from "@/types/database";
import { Icon } from "@/components/ui/Icon";

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
  const [classId, setClassId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [specializationId, setSpecializationId] = useState("");

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

      const result = await createLessonAction(fd);

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
              setClassId("");
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
            <Combobox
              label="התמחות"
              name="specialization_id"
              required
              value={specializationId}
              onChange={setSpecializationId}
              options={specializations.map((s) => ({ value: s.id, label: s.name }))}
              emptyLabel="בחרי התמחות"
            />
          ) : (
            <>
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface sm:col-span-2">
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
                  className="rounded border-outline-variant"
                />
                מיועד לפסיכולוגיה
              </label>
              {!forPsychology && (
                <>
                  <Combobox
                    label="כיתה"
                    name="class_id"
                    value={classId}
                    onChange={setClassId}
                    options={filteredClasses.map((c) => ({ value: c.id, label: c.name }))}
                    emptyLabel="ללא (כל הכיתות בשכבה)"
                  />
                  <Combobox
                    label="מסלול"
                    name="track_id"
                    value={trackId}
                    onChange={setTrackId}
                    options={tracks.map((t) => ({ value: t.id, label: t.name }))}
                    emptyLabel="ללא (כל המסלולים)"
                  />
                </>
              )}
            </>
          )}
        </div>
        <p className="mt-2 rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
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
        <p className="mb-2 font-label-md text-label-md text-primary">לוח זמנים ונוכחות</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="יום בשבוע"
            name="day_of_week"
            required
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
          השיעור הוא תבנית שבועית בטווח התאריכים שנבחר. טווח יכול להיות יום אחד (מוגדר
          בטווחי פעילות). ימי חופשה מלוח החופשות לא מקבלים מופע ולא נספרים בנוכחות.
        </p>
      </div>

      {gradeId && (
        <div className="rounded-lg border border-secondary/20 bg-secondary-container/40 px-3 py-2 font-body-sm text-body-sm text-primary">
          <div className="font-semibold">סיכום</div>
          <div className="mt-1 text-on-surface-variant">קהל: {audienceSummary}</div>
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
