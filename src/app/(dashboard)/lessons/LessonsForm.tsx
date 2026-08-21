"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction, createLessonForDateAction } from "../actions";
import { isoToHDate } from "@/lib/dates/hebrew";
import type { ActivityRange, AttendanceRule, BillingType } from "@/types/database";

export interface TeachingAssignmentOption {
  id: string;
  subject: string;
  billing_type: BillingType;
  teachers: { full_name: string } | null;
  gradeName?: string | null;
  className?: string | null;
  trackName?: string | null;
  specializationName?: string | null;
}

interface LessonsFormProps {
  yearId: string;
  occurrenceDate?: string;
  teachingAssignments: TeachingAssignmentOption[];
  ranges: ActivityRange[];
  rules: AttendanceRule[];
  onCreated?: () => void;
}

function scopeLabel(t: TeachingAssignmentOption): string {
  const grade = t.gradeName ? `${t.gradeName} · ` : "";
  if (t.billing_type === "specialization") {
    return `${grade}התמחות · ${t.specializationName ?? "—"}`;
  }
  if (t.className && t.trackName) {
    return `${grade}${t.className} ∩ ${t.trackName}`;
  }
  if (t.className) return `${grade}${t.className}`;
  if (t.trackName) return `${grade}${t.trackName}`;
  return `${grade}חובה`;
}

export function LessonsForm({
  yearId,
  occurrenceDate,
  teachingAssignments,
  ranges,
  rules,
  onCreated,
}: LessonsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [teachingId, setTeachingId] = useState("");
  const defaultDay =
    occurrenceDate != null ? String(isoToHDate(occurrenceDate).getDay()) : undefined;

  const selected = useMemo(
    () => teachingAssignments.find((t) => t.id === teachingId) ?? null,
    [teachingAssignments, teachingId]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      if (occurrenceDate) fd.set("occurrence_date", occurrenceDate);
      const result = occurrenceDate
        ? await createLessonForDateAction(fd)
        : await createLessonAction(fd);
      if (result && "error" in result && result.error) setError(result.error);
      else {
        form.reset();
        setTeachingId("");
        onCreated?.();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
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
          { value: "", label: "בחרי שיבוץ" },
          ...teachingAssignments.map((t) => ({
            value: t.id,
            label: `${t.teachers?.full_name ?? "מורה"} · ${t.subject} · ${scopeLabel(t)}`,
          })),
        ]}
      />
      {selected && (
        <p className="w-full text-sm text-slate-600">
          מקצוע: <span className="font-medium text-slate-800">{selected.subject}</span>
          {" · "}
          סוג:{" "}
          <span className="font-medium text-slate-800">
            {BILLING_TYPE_LABELS[selected.billing_type]}
          </span>
          {" · "}
          קהל: <span className="font-medium text-slate-800">{scopeLabel(selected)}</span>
        </p>
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
          ...rules.map((r) => ({
            value: r.id,
            label: `${r.name} (${r.max_allowed_absence_percent}%)`,
          })),
        ]}
      />
      <Button type="submit">{occurrenceDate ? "יצירה ליום זה" : "יצירה"}</Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
