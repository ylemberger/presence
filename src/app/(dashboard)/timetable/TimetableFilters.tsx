"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";

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
    <Section icon="filter_list" title="סינון מערכת שעות">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
      <Combobox
        label="שכבה/כיתה"
        name="classId"
        defaultValue={defaults.classId ?? ""}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
      />

      <Combobox
        label="מסלול"
        name="trackId"
        defaultValue={defaults.trackId ?? ""}
        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Combobox
        label="התמחות"
        name="specializationId"
        defaultValue={defaults.specializationId ?? ""}
        options={specializations.map((s) => ({ value: s.id, label: s.name }))}
      />

      <Combobox
        label="מורה"
        name="teacherId"
        defaultValue={defaults.teacherId ?? ""}
        options={teachers.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Combobox
        label="מקצוע"
        name="subject"
        defaultValue={defaults.subject ?? ""}
        options={subjects.map((s) => ({ value: s, label: s }))}
      />

      <Combobox
        label="תלמידה"
        name="studentId"
        defaultValue={defaults.studentId ?? ""}
        options={students.map((s) => ({ value: s.id, label: s.full_name }))}
      />

      <Combobox
        label="טווח פעילות"
        name="activityRangeId"
        defaultValue={defaults.activityRangeId ?? ""}
        options={activityRanges.map((r) => ({ value: r.id, label: r.name }))}
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

      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <Button type="submit" className="w-full sm:w-auto">
          <Icon name="search" className="text-[18px]" />
          הצג מערכת שעות
        </Button>
      </div>
      </form>
    </Section>
  );
}

