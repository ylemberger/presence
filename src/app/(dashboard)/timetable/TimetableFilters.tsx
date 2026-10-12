"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { MultiSelect } from "@/components/ui/MultiSelect";
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
    classIds?: string[];
    trackIds?: string[];
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
  const [classIds, setClassIds] = useState(defaults.classIds ?? []);
  const [trackIds, setTrackIds] = useState(defaults.trackIds ?? []);
  const classKey = (defaults.classIds ?? []).join(",");
  const trackKey = (defaults.trackIds ?? []).join(",");

  useEffect(() => {
    setClassIds(classKey ? classKey.split(",") : []);
  }, [classKey]);

  useEffect(() => {
    setTrackIds(trackKey ? trackKey.split(",") : []);
  }, [trackKey]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const selectedClasses = fd.getAll("classId").map(String).filter(Boolean);
    if (selectedClasses.length) params.set("classId", selectedClasses.join(","));
    const selectedTracks = fd.getAll("trackId").map(String).filter(Boolean);
    if (selectedTracks.length) params.set("trackId", selectedTracks.join(","));

    for (const key of [
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
      <MultiSelect
        label="כיתות"
        name="classId"
        hint="אפשר לבחור כמה כיתות"
        values={classIds}
        onChange={setClassIds}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
      />

      <MultiSelect
        label="מסלולים"
        name="trackId"
        hint="אפשר לבחור כמה מסלולים"
        values={trackIds}
        onChange={setTrackIds}
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
        maxSuggestions={40}
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

