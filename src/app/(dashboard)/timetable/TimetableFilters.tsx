"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";

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
    week?: string;
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

  function apply(patch: {
    classIds?: string[];
    trackIds?: string[];
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    activityRangeId?: string;
    forPsychology?: "all" | "yes" | "no";
  }) {
    const nextClass = patch.classIds ?? classIds;
    const nextTrack = patch.trackIds ?? trackIds;
    const params = new URLSearchParams();
    if (nextClass.length) params.set("classId", nextClass.join(","));
    if (nextTrack.length) params.set("trackId", nextTrack.join(","));

    const spec = patch.specializationId !== undefined ? patch.specializationId : defaults.specializationId;
    const teacher = patch.teacherId !== undefined ? patch.teacherId : defaults.teacherId;
    const subject = patch.subject !== undefined ? patch.subject : defaults.subject;
    const student = patch.studentId !== undefined ? patch.studentId : defaults.studentId;
    const range = patch.activityRangeId !== undefined ? patch.activityRangeId : defaults.activityRangeId;
    const psych = patch.forPsychology !== undefined ? patch.forPsychology : defaults.forPsychology;

    if (spec) params.set("specializationId", spec);
    if (teacher) params.set("teacherId", teacher);
    if (subject) params.set("subject", subject);
    if (student) params.set("studentId", student);
    if (range) params.set("activityRangeId", range);
    if (psych === "yes") params.set("forPsychology", "yes");
    if (psych === "no") params.set("forPsychology", "no");
    if (defaults.week) params.set("week", defaults.week);

    router.push(`/timetable?${params.toString()}`);
  }

  return (
    <Section icon="filter_list" title="סינון מערכת שעות">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MultiSelect
        label="כיתות"
        name="classId"
        hint="אפשר לבחור כמה כיתות"
        values={classIds}
        onChange={(next) => {
          setClassIds(next);
          apply({ classIds: next });
        }}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
      />

      <MultiSelect
        label="מסלולים"
        name="trackId"
        hint="אפשר לבחור כמה מסלולים"
        values={trackIds}
        onChange={(next) => {
          setTrackIds(next);
          apply({ trackIds: next });
        }}
        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Combobox
        label="התמחות"
        value={defaults.specializationId ?? ""}
        onChange={(v) => apply({ specializationId: v })}
        options={specializations.map((s) => ({ value: s.id, label: s.name }))}
      />

      <Combobox
        label="מורה"
        value={defaults.teacherId ?? ""}
        onChange={(v) => apply({ teacherId: v })}
        options={teachers.map((t) => ({ value: t.id, label: t.name }))}
        maxSuggestions={80}
      />

      <Combobox
        label="מקצוע"
        value={defaults.subject ?? ""}
        onChange={(v) => apply({ subject: v })}
        options={subjects.map((s) => ({ value: s, label: s }))}
      />

      <Combobox
        label="תלמידה"
        value={defaults.studentId ?? ""}
        onChange={(v) => apply({ studentId: v })}
        options={students.map((s) => ({ value: s.id, label: s.full_name }))}
      />

      <Combobox
        label="טווח פעילות"
        value={defaults.activityRangeId ?? ""}
        onChange={(v) => apply({ activityRangeId: v })}
        options={activityRanges.map((r) => ({ value: r.id, label: r.name }))}
      />

      <Select
        label="פסיכולוגיה"
        value={defaults.forPsychology ?? "all"}
        onChange={(e) => apply({ forPsychology: e.target.value as "all" | "yes" | "no" })}
        options={[
          { value: "all", label: "הכל" },
          { value: "yes", label: "כן" },
          { value: "no", label: "לא" },
        ]}
      />
      </div>
    </Section>
  );
}
