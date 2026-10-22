"use client";

import { Combobox } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { usePendingRouter } from "@/lib/ui/nav-pending";

export type MakeupFilterStatus = "all" | "open" | "done" | "blocked";

interface MakeupFiltersProps {
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  subjects: string[];
  defaults: {
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    status?: MakeupFilterStatus;
    chetz?: string;
  };
}

export function MakeupFilters({
  classes,
  tracks,
  specializations,
  teachers,
  students,
  subjects,
  defaults,
}: MakeupFiltersProps) {
  const { push } = usePendingRouter();

  function apply(patch: Partial<MakeupFiltersProps["defaults"]>) {
    const next = { ...defaults, ...patch };
    const params = new URLSearchParams();
    for (const key of [
      "classId",
      "trackId",
      "specializationId",
      "teacherId",
      "subject",
      "studentId",
      "status",
      "chetz",
    ] as const) {
      const value = next[key];
      if (value && value !== "all") params.set(key, value);
    }
    params.set("run", "1");
    push(`/makeup?${params.toString()}`, { scroll: false });
  }

  return (
    <Section icon="filter_list" title="סינון מבחני השלמה">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Combobox
          label="כיתה"
          value={defaults.classId ?? ""}
          onChange={(v) => apply({ classId: v || undefined })}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          emptyLabel="כל הכיתות"
        />
        <Combobox
          label="מסלול"
          value={defaults.trackId ?? ""}
          onChange={(v) => apply({ trackId: v || undefined })}
          options={tracks.map((t) => ({ value: t.id, label: t.name }))}
          emptyLabel="כל המסלולים"
        />
        <Combobox
          label="התמחות"
          value={defaults.specializationId ?? ""}
          onChange={(v) => apply({ specializationId: v || undefined })}
          options={specializations.map((s) => ({ value: s.id, label: s.name }))}
          emptyLabel="כל ההתמחויות"
        />
        <Combobox
          label="מורה"
          value={defaults.teacherId ?? ""}
          onChange={(v) => apply({ teacherId: v || undefined })}
          options={teachers.map((t) => ({ value: t.id, label: t.name }))}
          emptyLabel="כל המורות"
          maxSuggestions={80}
        />
        <Combobox
          label="מקצוע"
          value={defaults.subject ?? ""}
          onChange={(v) => apply({ subject: v || undefined })}
          options={subjects.map((s) => ({ value: s, label: s }))}
          emptyLabel="כל המקצועות"
        />
        <Select
          label="תוכנית חץ"
          value={defaults.chetz ?? "all"}
          onChange={(e) =>
            apply({ chetz: e.target.value === "all" ? undefined : e.target.value })
          }
          options={[
            { value: "all", label: "הכל" },
            { value: "yes", label: "לומדת חץ" },
            { value: "no", label: "לא לומדת חץ" },
          ]}
        />
        <Combobox
          label="תלמידה"
          value={defaults.studentId ?? ""}
          onChange={(v) => apply({ studentId: v || undefined })}
          options={students.map((s) => ({ value: s.id, label: s.full_name }))}
          emptyLabel="כל התלמידות"
        />
        <Select
          label="סטטוס"
          value={defaults.status ?? "all"}
          onChange={(e) => apply({ status: e.target.value as MakeupFilterStatus })}
          options={[
            { value: "all", label: "הכל" },
            { value: "open", label: "פתוח" },
            { value: "done", label: "הושלם" },
            { value: "blocked", label: "חסום" },
          ]}
        />
      </div>
    </Section>
  );
}
