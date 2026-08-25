"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";

interface ReportsFilterProps {
  grades: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  subjects: string[];
  lessons: { id: string; label: string }[];
  rules: { id: string; name: string; max_allowed_absence_percent: number }[];
  defaults: {
    minAbsence: string;
    gradeId?: string;
    classId?: string;
    trackId?: string;
    specializationId?: string;
    teacherId?: string;
    subject?: string;
    studentId?: string;
    lessonId?: string;
    ruleId?: string;
  };
}

export function ReportsFilter({
  grades,
  classes,
  tracks,
  specializations,
  teachers,
  students,
  subjects,
  lessons,
  rules,
  defaults,
}: ReportsFilterProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of [
      "gradeId",
      "classId",
      "trackId",
      "specializationId",
      "teacherId",
      "subject",
      "studentId",
      "lessonId",
      "minAbsence",
      "ruleId",
    ]) {
      const value = fd.get(key) as string;
      if (value) params.set(key, value);
    }
    params.set("run", "1");
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <Section icon="filter_list" title="סינון נתונים">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Combobox
            label="שכבה נוכחית"
            name="gradeId"
            defaultValue={defaults.gradeId ?? ""}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="כל השכבות"
          />
          <Combobox
            label="כיתה נוכחית"
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
          <div className="md:col-span-2">
            <Combobox
              label="שיעור"
              name="lessonId"
              defaultValue={defaults.lessonId ?? ""}
              options={lessons.map((l) => ({ value: l.id, label: l.label }))}
              emptyLabel="כל השיעורים"
            />
            <p className="mt-1 font-caption text-caption text-on-surface-variant">
              בלי שיעור נבחר מוצגים השיעורים ומצב כל אחד. בחירת שיעור פותחת את המופעים שלו.
            </p>
          </div>
          <Combobox
            label="כלל נוכחות"
            name="ruleId"
            defaultValue={defaults.ruleId ?? ""}
            options={rules.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.max_allowed_absence_percent}%)`,
            }))}
            emptyLabel="ללא סף מכלל"
          />
          <Input
            label="סף חיסורים (%)"
            name="minAbsence"
            type="number"
            step="0.01"
            defaultValue={defaults.minAbsence}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit">
            <Icon name="search" className="text-[18px]" />
            החל סינון
          </Button>
        </div>
      </form>
    </Section>
  );
}
