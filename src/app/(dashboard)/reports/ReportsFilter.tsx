"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";

interface LessonOption {
  id: string;
  label: string;
  teacherId?: string | null;
  subject?: string | null;
  classId?: string | null;
  trackId?: string | null;
  specializationId?: string | null;
}

interface ReportsFilterProps {
  grades: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
  subjects: string[];
  lessons: LessonOption[];
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

  const lessonOptions = useMemo(() => {
    return lessons.filter((l) => {
      if (defaults.teacherId && l.teacherId && l.teacherId !== defaults.teacherId) return false;
      if (defaults.subject && l.subject && l.subject !== defaults.subject && !l.label.startsWith(`${defaults.subject} ·`)) {
        return false;
      }
      if (defaults.classId && l.classId && l.classId !== defaults.classId) return false;
      if (defaults.trackId && l.trackId && l.trackId !== defaults.trackId) return false;
      if (defaults.specializationId && l.specializationId && l.specializationId !== defaults.specializationId) {
        return false;
      }
      return true;
    });
  }, [lessons, defaults.teacherId, defaults.subject, defaults.classId, defaults.trackId, defaults.specializationId]);

  function lessonMatches(
    l: LessonOption,
    f: Pick<ReportsFilterProps["defaults"], "teacherId" | "subject" | "classId" | "trackId" | "specializationId">
  ) {
    if (f.teacherId && l.teacherId && l.teacherId !== f.teacherId) return false;
    if (f.subject && l.subject && l.subject !== f.subject && !l.label.startsWith(`${f.subject} ·`)) {
      return false;
    }
    if (f.classId && l.classId && l.classId !== f.classId) return false;
    if (f.trackId && l.trackId && l.trackId !== f.trackId) return false;
    if (f.specializationId && l.specializationId && l.specializationId !== f.specializationId) {
      return false;
    }
    return true;
  }

  function apply(patch: Partial<ReportsFilterProps["defaults"]>) {
    const next = { ...defaults, ...patch };
    if (patch.lessonId === undefined && next.lessonId) {
      const current = lessons.find((l) => l.id === next.lessonId);
      if (!current || !lessonMatches(current, next)) next.lessonId = undefined;
    }
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
    ] as const) {
      const value = next[key];
      if (value) params.set(key, value);
    }
    params.set("run", "1");
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <Section icon="filter_list" title="סינון נתונים">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Combobox
            label="שכבה נוכחית"
            value={defaults.gradeId ?? ""}
            onChange={(v) => apply({ gradeId: v || undefined })}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="כל השכבות"
          />
          <Combobox
            label="כיתה נוכחית"
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
          <Combobox
            label="תלמידה"
            value={defaults.studentId ?? ""}
            onChange={(v) => apply({ studentId: v || undefined })}
            options={students.map((s) => ({ value: s.id, label: s.full_name }))}
            emptyLabel="כל התלמידות"
          />
          <div className="md:col-span-2">
            <Combobox
              label="שיעור"
              value={defaults.lessonId ?? ""}
              onChange={(v) => apply({ lessonId: v || undefined })}
              options={lessonOptions.map((l) => ({ value: l.id, label: l.label }))}
              emptyLabel={lessonOptions.length ? "כל השיעורים לפי הסינון" : "אין שיעורים לפי הסינון"}
              maxSuggestions={Math.max(80, lessonOptions.length)}
            />
            <p className="mt-1 font-caption text-caption text-on-surface-variant">
              רשימת השיעורים מתעדכנת לפי הסינון למעלה. בחירת שיעור פותחת את המופעים שלו.
            </p>
          </div>
          <Combobox
            label="כלל נוכחות"
            value={defaults.ruleId ?? ""}
            onChange={(v) => apply({ ruleId: v || undefined })}
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
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== defaults.minAbsence) apply({ minAbsence: v || undefined });
            }}
          />
        </div>
      </div>
    </Section>
  );
}
