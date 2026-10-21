"use client";

import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";
import { Section } from "@/components/ui/Section";

export interface LessonsFiltersProps {
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  subjects: string[];
  defaults: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
  };
  keepEdit?: string;
  keepDate?: string;
}

export function LessonsFilters({
  classes,
  tracks,
  specializations,
  teachers,
  subjects,
  defaults,
  keepEdit,
  keepDate,
}: LessonsFiltersProps) {
  const router = useRouter();

  function apply(patch: Partial<LessonsFiltersProps["defaults"]>) {
    const next = { ...defaults, ...patch };
    const params = new URLSearchParams();
    for (const key of ["classId", "trackId", "specializationId", "teacherId", "subject"] as const) {
      if (next[key]) params.set(key, next[key] as string);
    }
    if (keepDate) params.set("date", keepDate);
    if (keepEdit) params.set("edit", keepEdit);
    const q = params.toString();
    router.push(q ? `/lessons?${q}` : "/lessons", { scroll: false });
  }

  return (
    <Section icon="filter_list" title="סינון שיעורים">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Combobox
          label="כיתה"
          value={defaults.classId ?? ""}
          onChange={(v) => apply({ classId: v || undefined })}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Combobox
          label="מסלול"
          value={defaults.trackId ?? ""}
          onChange={(v) => apply({ trackId: v || undefined })}
          options={tracks.map((t) => ({ value: t.id, label: t.name }))}
        />
        <Combobox
          label="התמחות"
          value={defaults.specializationId ?? ""}
          onChange={(v) => apply({ specializationId: v || undefined })}
          options={specializations.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Combobox
          label="מורה"
          value={defaults.teacherId ?? ""}
          onChange={(v) => apply({ teacherId: v || undefined })}
          options={teachers.map((t) => ({ value: t.id, label: t.name }))}
          maxSuggestions={80}
        />
        <Combobox
          label="מקצוע"
          value={defaults.subject ?? ""}
          onChange={(v) => apply({ subject: v || undefined })}
          options={subjects.map((s) => ({ value: s, label: s }))}
        />
      </div>
    </Section>
  );
}
