"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction, createLessonForDateAction } from "../actions";
import { isoToHDate } from "@/lib/dates/hebrew";
import type { Grade, Class, Track, Specialization, ActivityRange, AttendanceRule } from "@/types/database";

interface LessonsFormProps {
  yearId: string;
  occurrenceDate?: string;
  teachingAssignments: Array<{ id: string; subject: string; teachers: { full_name: string } }>;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  ranges: ActivityRange[];
  rules: AttendanceRule[];
  onCreated?: () => void;
}

export function LessonsForm({
  yearId,
  occurrenceDate,
  teachingAssignments,
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
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">("mandatory");
  const [teachingId, setTeachingId] = useState("");
  const defaultDay =
    occurrenceDate != null ? String(isoToHDate(occurrenceDate).getDay()) : undefined;

  const selectedSubject = useMemo(() => {
    return teachingAssignments.find((t) => t.id === teachingId)?.subject ?? "";
  }, [teachingAssignments, teachingId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("academic_year_id", yearId);
    fd.set("billing_type", billingType);
    if (occurrenceDate) fd.set("occurrence_date", occurrenceDate);
    if (billingType === "specialization") {
      fd.set("class_id", "");
      fd.set("track_id", "");
    } else {
      fd.set("specialization_id", "");
    }
    const result = occurrenceDate
      ? await createLessonForDateAction(fd)
      : await createLessonAction(fd);
    if (result && "error" in result && result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      setTeachingId("");
      setBillingType("mandatory");
      onCreated?.();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="שיבוץ הוראה"
        name="teacher_teaching_assignment_id"
        required
        value={teachingId}
        onChange={(e) => setTeachingId(e.target.value)}
        options={[
          { value: "", label: "בחרי" },
          ...teachingAssignments.map((t) => ({
            value: t.id,
            label: `${t.teachers?.full_name} - ${t.subject}`,
          })),
        ]}
      />
      {selectedSubject && (
        <p className="text-sm text-slate-600">
          מקצוע: <span className="font-medium text-slate-800">{selectedSubject}</span>
        </p>
      )}
      <Select
        label="שכבה"
        name="grade_id"
        required
        options={[
          { value: "", label: "בחרי" },
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
          options={[
            { value: "", label: "בחרי" },
            ...specializations.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      ) : (
        <>
          <Select
            label="כיתה"
            name="class_id"
            options={[
              { value: "", label: "ללא" },
              ...classes.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
          label="מסלול"
          name="track_id"
          options={[
            { value: "", label: "ללא" },
            ...tracks.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
          <p className="w-full text-xs text-slate-500">בשיעור חובה יש לבחור כיתה או מסלול (או את שתיהן).</p>
        </>
      )}
      <Select
        label="יום בשבוע"
        name="day_of_week"
        required
        defaultValue={defaultDay}
        options={DAY_OF_WEEK_LABELS.map((l, i) => ({ value: String(i), label: l }))}
      />
      <Input label="מספר שיעור (1-9)" name="lesson_number" type="number" min={1} max={9} required />
      <Select
        label="טווח פעילות"
        name="activity_range_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...ranges.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />
      <Select
        label="כלל נוכחות"
        name="attendance_rule_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...rules.map((r) => ({ value: r.id, label: `${r.name} (${r.max_allowed_absence_percent}%)` })),
        ]}
      />
      <Button type="submit">{occurrenceDate ? "יצירה ליום זה" : "יצירה"}</Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
