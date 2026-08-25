"use client";

import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

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
      "status",
    ] as const) {
      const value = fd.get(key) as string;
      if (value) params.set(key, value);
    }

    params.set("run", "1");
    router.push(`/makeup?${params.toString()}`);
  }

  return (
    <Section icon="filter_list" title="סינון מבחני השלמה">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
      <Combobox
        label="כיתה"
        name="classId"
        defaultValue={defaults.classId ?? ""}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
        emptyLabel="כל הכיתות"
      />

      <Combobox
        label="מסלול"
        name="trackId"
        defaultValue={defaults.trackId ?? ""}
        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
        emptyLabel="כל המסלולים"
      />

      <Combobox
        label="התמחות"
        name="specializationId"
        defaultValue={defaults.specializationId ?? ""}
        options={specializations.map((s) => ({ value: s.id, label: s.name }))}
        emptyLabel="כל ההתמחויות"
      />

      <Combobox
        label="מורה"
        name="teacherId"
        defaultValue={defaults.teacherId ?? ""}
        options={teachers.map((t) => ({ value: t.id, label: t.name }))}
        emptyLabel="כל המורות"
      />

      <Combobox
        label="מקצוע"
        name="subject"
        defaultValue={defaults.subject ?? ""}
        options={subjects.map((s) => ({ value: s, label: s }))}
        emptyLabel="כל המקצועות"
      />

      <Combobox
        label="תלמידה"
        name="studentId"
        defaultValue={defaults.studentId ?? ""}
        options={students.map((s) => ({ value: s.id, label: s.full_name }))}
        emptyLabel="כל התלמידות"
      />

      <Select
        label="סטטוס"
        name="status"
        defaultValue={defaults.status ?? "all"}
        options={[
          { value: "all", label: "הכל" },
          { value: "open", label: "פתוח" },
          { value: "done", label: "הושלם" },
          { value: "blocked", label: "חסום" },
        ]}
      />

      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <Button type="submit" className="w-full sm:w-auto">
          <Icon name="search" className="text-[18px]" />
          הצג מבחנים
        </Button>
      </div>
      </form>
    </Section>
  );
}

