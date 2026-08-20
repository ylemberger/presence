"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DAY_OF_WEEK_LABELS, BILLING_TYPE_LABELS } from "@/lib/constants";
import { createLessonAction } from "../actions";
import type { Grade, Class, Track, Specialization, ActivityRange, AttendanceRule } from "@/types/database";

interface LessonsFormProps {
  yearId: string;
  teachingAssignments: Array<{ id: string; subject: string; teachers: { full_name: string } }>;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  ranges: ActivityRange[];
  rules: AttendanceRule[];
}

export function LessonsForm({
  yearId,
  teachingAssignments,
  grades,
  classes,
  tracks,
  specializations,
  ranges,
  rules,
}: LessonsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("academic_year_id", yearId);
    const result = await createLessonAction(fd);
    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="שיבוץ הוראה"
        name="teacher_teaching_assignment_id"
        required
        options={[
          { value: "", label: "בחרי" },
          ...teachingAssignments.map((t) => ({
            value: t.id,
            label: `${t.teachers?.full_name} - ${t.subject}`,
          })),
        ]}
      />
      <Input label="מקצוע" name="subject" required />
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
        label="כיתה"
        name="class_id"
        options={[
          { value: "", label: "ללא" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="מגמה"
        name="track_id"
        options={[
          { value: "", label: "ללא" },
          ...tracks.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />
      <Select
        label="התמחות"
        name="specialization_id"
        options={[
          { value: "", label: "ללא" },
          ...specializations.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <Select
        label="סוג חיוב"
        name="billing_type"
        required
        options={Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => ({
          value: v,
          label: l,
        }))}
      />
      <Select
        label="יום בשבוע"
        name="day_of_week"
        required
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
        options={[
          { value: "", label: "ללא" },
          ...rules.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />
      <Button type="submit">יצירה</Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
