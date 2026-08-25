"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Section } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";

export interface LessonsFiltersProps {
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  subjects: string[];
  monthFrom?: string;
  monthTo?: string;
  defaults: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
  };
}

export function LessonsFilters({
  classes,
  tracks,
  specializations,
  teachers,
  subjects,
  monthFrom,
  monthTo,
  defaults,
}: LessonsFiltersProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    if (monthFrom) params.set("from", monthFrom);
    if (monthTo) params.set("to", monthTo);

    for (const key of ["classId", "trackId", "specializationId", "teacherId", "subject"] as const) {
      const value = fd.get(key) as string;
      if (value) params.set(key, value);
    }

    router.push(`/lessons?${params.toString()}`);
  }

  return (
    <Section icon="filter_list" title="סינון שיעורים">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Combobox
          label="כיתה"
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
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <Button type="submit" className="w-full sm:w-auto">
            <Icon name="search" className="text-[18px]" />
            החל סינון
          </Button>
        </div>
      </form>
    </Section>
  );
}
