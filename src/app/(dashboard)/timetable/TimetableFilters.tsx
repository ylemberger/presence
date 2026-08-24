"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

export interface TimetableFiltersProps {
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  subjects: string[];
  activityRanges: { id: string; name: string }[];
  defaults: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    activityRangeId?: string;
    forPsychology?: "all" | "yes" | "no";
  };
}

export function TimetableFilters({
  classes,
  tracks,
  specializations,
  teachers,
  students,
  subjects,
  activityRanges,
  defaults,
}: TimetableFiltersProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    for (const key of [
      "classId",
      "trackId",
      "specializationId",
      "teacherId",
      "subject",
      "studentId",
      "activityRangeId",
    ] as const) {
      const value = fd.get(key) as string;
      if (value) params.set(key, value);
    }

    const psych = fd.get("forPsychology") as string;
    if (psych === "yes") params.set("forPsychology", "yes");
    if (psych === "no") params.set("forPsychology", "no");

    router.push(`/timetable?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Select
        label="שכבה/כיתה"
        name="classId"
        defaultValue={defaults.classId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />

      <Select
        label="מסלול"
        name="trackId"
        defaultValue={defaults.trackId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...tracks.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />

      <Select
        label="התמחות"
        name="specializationId"
        defaultValue={defaults.specializationId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...specializations.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />

      <Select
        label="מורה"
        name="teacherId"
        defaultValue={defaults.teacherId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...teachers.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />

      <Select
        label="מקצוע"
        name="subject"
        defaultValue={defaults.subject ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...subjects.map((s) => ({ value: s, label: s })),
        ]}
      />

      <Select
        label="תלמידה"
        name="studentId"
        defaultValue={defaults.studentId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...students.map((s) => ({ value: s.id, label: s.full_name })),
        ]}
      />

      <Select
        label="טווח פעילות"
        name="activityRangeId"
        defaultValue={defaults.activityRangeId ?? ""}
        options={[
          { value: "", label: "הכל" },
          ...activityRanges.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />

      <Select
        label="פסיכולוגיה"
        name="forPsychology"
        defaultValue={defaults.forPsychology ?? "all"}
        options={[
          { value: "all", label: "הכל" },
          { value: "yes", label: "כן" },
          { value: "no", label: "לא" },
        ]}
      />

      <div className="flex items-end">
        <Button type="submit">הצג מערכת שעות</Button>
      </div>
    </form>
  );
}

