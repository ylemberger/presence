"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";

interface LessonOption {
  id: string;
  label: string;
  teacherId?: string | null;
  subject?: string | null;
  gradeIds?: string[];
  classIds?: string[];
  trackIds?: string[];
  specializationIds?: string[];
}

interface StudentOption {
  id: string;
  full_name: string;
  gradeId?: string | null;
  classId?: string | null;
  trackId?: string | null;
  specId?: string | null;
  secondarySpecId?: string | null;
  chetz?: boolean;
}

type FilterValues = {
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
  chetz?: string;
};

type LessonFilterKey = "gradeId" | "classId" | "trackId" | "specializationId" | "teacherId" | "subject" | "lessonId";

interface ReportsFilterProps {
  grades: { id: string; name: string }[];
  classes: { id: string; name: string; grade_id?: string | null }[];
  tracks: { id: string; name: string }[];
  specializations: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  students: StudentOption[];
  subjects: string[];
  lessons: LessonOption[];
  rules: { id: string; name: string; max_allowed_absence_percent: number }[];
  defaults: FilterValues;
}

function lessonMatches(l: LessonOption, f: FilterValues, except?: LessonFilterKey): boolean {
  if (except !== "teacherId" && f.teacherId && l.teacherId !== f.teacherId) return false;
  if (except !== "subject" && f.subject) {
    if (l.subject !== f.subject && !(l.label.startsWith(`${f.subject} ·`))) return false;
  }
  if (except !== "gradeId" && f.gradeId && !(l.gradeIds ?? []).includes(f.gradeId)) return false;
  if (except !== "classId" && f.classId && !(l.classIds ?? []).includes(f.classId)) return false;
  if (except !== "trackId" && f.trackId && !(l.trackIds ?? []).includes(f.trackId)) return false;
  if (
    except !== "specializationId" &&
    f.specializationId &&
    !(l.specializationIds ?? []).includes(f.specializationId)
  ) {
    return false;
  }
  if (except !== "lessonId" && f.lessonId && l.id !== f.lessonId) return false;
  return true;
}

function studentFitsLesson(s: StudentOption, l: LessonOption): boolean {
  const grades = l.gradeIds ?? [];
  const classIds = l.classIds ?? [];
  const trackIds = l.trackIds ?? [];
  const specs = l.specializationIds ?? [];
  if (grades.length && s.gradeId && !grades.includes(s.gradeId)) return false;
  if (classIds.length && s.classId && !classIds.includes(s.classId)) return false;
  if (trackIds.length && s.trackId && !trackIds.includes(s.trackId)) return false;
  if (specs.length) {
    const ok =
      (s.specId && specs.includes(s.specId)) ||
      (s.secondarySpecId && specs.includes(s.secondarySpecId));
    if (!ok) return false;
  }
  return true;
}

export function ReportsFilter({
  grades,
  classes,
  tracks,
  specializations,
  teachers,
  students,
  lessons,
  rules,
  defaults,
}: ReportsFilterProps) {
  const router = useRouter();

  const scoped = useMemo(() => {
    function by(except?: LessonFilterKey) {
      return lessons.filter((l) => lessonMatches(l, defaults, except));
    }
    const forTeachers = by("teacherId");
    const forSubjects = by("subject");
    const forSpecs = by("specializationId");
    const forTracks = by("trackId");
    const forClasses = by("classId");
    const forGrades = by("gradeId");
    const forLessons = by("lessonId");

    const teacherIds = new Set(forTeachers.map((l) => l.teacherId).filter(Boolean) as string[]);
    const subjectNames = [...new Set(forSubjects.map((l) => l.subject).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, "he")
    );
    const specIds = new Set(forSpecs.flatMap((l) => l.specializationIds ?? []));
    const trackIds = new Set(forTracks.flatMap((l) => l.trackIds ?? []));
    const classIds = new Set(forClasses.flatMap((l) => l.classIds ?? []));
    const gradeIds = new Set(forGrades.flatMap((l) => l.gradeIds ?? []));

    const relevantLessons = by();
    const studentRows = students.filter((s) => {
      if (defaults.gradeId && s.gradeId !== defaults.gradeId) return false;
      if (defaults.classId && s.classId !== defaults.classId) return false;
      if (defaults.trackId && s.trackId !== defaults.trackId) return false;
      if (
        defaults.specializationId &&
        s.specId !== defaults.specializationId &&
        s.secondarySpecId !== defaults.specializationId
      ) {
        return false;
      }
      if (defaults.chetz === "yes" && !s.chetz) return false;
      if (defaults.chetz === "no" && s.chetz) return false;
      if (defaults.studentId && s.id !== defaults.studentId) {
        /* keep listed in own dropdown via except — handled below */
      }
      if (defaults.lessonId || defaults.teacherId || defaults.subject) {
        return relevantLessons.some((l) => studentFitsLesson(s, l));
      }
      return true;
    });

    return {
      teachers: teachers.filter((t) => teacherIds.has(t.id)),
      subjects: subjectNames,
      specializations: specializations.filter((s) => specIds.has(s.id)),
      tracks: tracks.filter((t) => trackIds.has(t.id)),
      classes: classes.filter((c) => {
        if (defaults.gradeId && c.grade_id && c.grade_id !== defaults.gradeId) return false;
        return classIds.size === 0 ? !defaults.specializationId && !defaults.teacherId && !defaults.subject : classIds.has(c.id);
      }),
      grades: grades.filter((g) => (gradeIds.size === 0 ? !defaults.teacherId && !defaults.subject && !defaults.specializationId : gradeIds.has(g.id))),
      lessons: forLessons,
      students: studentRows,
    };
  }, [lessons, defaults, teachers, specializations, tracks, classes, grades, students]);

  function apply(patch: Partial<FilterValues>) {
    const next: FilterValues = { ...defaults, ...patch };
    const scopedLessons = (except?: LessonFilterKey) =>
      lessons.filter((l) => lessonMatches(l, next, except));

    if (patch.teacherId === undefined && next.teacherId) {
      const ok = new Set(scopedLessons("teacherId").map((l) => l.teacherId));
      if (!ok.has(next.teacherId)) next.teacherId = undefined;
    }
    if (patch.subject === undefined && next.subject) {
      const ok = new Set(scopedLessons("subject").map((l) => l.subject));
      if (!ok.has(next.subject)) next.subject = undefined;
    }
    if (patch.specializationId === undefined && next.specializationId) {
      const ok = new Set(scopedLessons("specializationId").flatMap((l) => l.specializationIds ?? []));
      if (!ok.has(next.specializationId)) next.specializationId = undefined;
    }
    if (patch.trackId === undefined && next.trackId) {
      const ok = new Set(scopedLessons("trackId").flatMap((l) => l.trackIds ?? []));
      if (!ok.has(next.trackId)) next.trackId = undefined;
    }
    if (patch.classId === undefined && next.classId) {
      const ok = new Set(scopedLessons("classId").flatMap((l) => l.classIds ?? []));
      if (!ok.has(next.classId)) next.classId = undefined;
    }
    if (patch.gradeId === undefined && next.gradeId) {
      const ok = new Set(scopedLessons("gradeId").flatMap((l) => l.gradeIds ?? []));
      if (!ok.has(next.gradeId)) next.gradeId = undefined;
    }
    if (patch.lessonId === undefined && next.lessonId) {
      if (!scopedLessons("lessonId").some((l) => l.id === next.lessonId)) next.lessonId = undefined;
    }
    if (patch.studentId === undefined && next.studentId) {
      const still = students.some((s) => {
        if (s.id !== next.studentId) return false;
        if (next.gradeId && s.gradeId !== next.gradeId) return false;
        if (next.classId && s.classId !== next.classId) return false;
        if (next.trackId && s.trackId !== next.trackId) return false;
        if (
          next.specializationId &&
          s.specId !== next.specializationId &&
          s.secondarySpecId !== next.specializationId
        ) {
          return false;
        }
        if (next.chetz === "yes" && !s.chetz) return false;
        if (next.chetz === "no" && s.chetz) return false;
        if (next.lessonId || next.teacherId || next.subject) {
          return lessons.filter((l) => lessonMatches(l, next)).some((l) => studentFitsLesson(s, l));
        }
        return true;
      });
      if (!still) next.studentId = undefined;
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
      "chetz",
    ] as const) {
      const value = next[key];
      if (value) params.set(key, value);
    }
    params.set("run", "1");
    router.push(`/reports?${params.toString()}`, { scroll: false });
  }

  const selectedTeacherStillListed =
    !defaults.teacherId || scoped.teachers.some((t) => t.id === defaults.teacherId);
  const teacherOptions = selectedTeacherStillListed
    ? scoped.teachers
    : teachers.filter((t) => t.id === defaults.teacherId);

  return (
    <Section icon="filter_list" title="סינון נתונים">
      <p className="mb-3 font-caption text-caption text-on-surface-variant">
        כל רשימה מצטמצמת לפי מה שכבר נבחר — למשל התמחות גרפיקה תציג רק מורות, מקצועות ושיעורים של גרפיקה.
      </p>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Combobox
            label="שכבה נוכחית"
            value={defaults.gradeId ?? ""}
            onChange={(v) => apply({ gradeId: v || undefined })}
            options={scoped.grades.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel={scoped.grades.length ? "כל השכבות לפי הסינון" : "אין שכבות לפי הסינון"}
          />
          <Combobox
            label="כיתה נוכחית"
            value={defaults.classId ?? ""}
            onChange={(v) => apply({ classId: v || undefined })}
            options={scoped.classes.map((c) => ({ value: c.id, label: c.name }))}
            emptyLabel={scoped.classes.length ? "כל הכיתות לפי הסינון" : "אין כיתות לפי הסינון"}
          />
          <Combobox
            label="מסלול"
            value={defaults.trackId ?? ""}
            onChange={(v) => apply({ trackId: v || undefined })}
            options={scoped.tracks.map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel={scoped.tracks.length ? "כל המסלולים לפי הסינון" : "אין מסלולים לפי הסינון"}
          />
          <Combobox
            label="התמחות"
            value={defaults.specializationId ?? ""}
            onChange={(v) => apply({ specializationId: v || undefined })}
            options={scoped.specializations.map((s) => ({ value: s.id, label: s.name }))}
            emptyLabel={scoped.specializations.length ? "כל ההתמחויות לפי הסינון" : "אין התמחויות לפי הסינון"}
          />
          <Combobox
            label="מורה"
            value={defaults.teacherId ?? ""}
            onChange={(v) => apply({ teacherId: v || undefined })}
            options={teacherOptions.map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel={scoped.teachers.length ? "כל המורות לפי הסינון" : "אין מורות לפי הסינון"}
            maxSuggestions={80}
          />
          <Combobox
            label="מקצוע"
            value={defaults.subject ?? ""}
            onChange={(v) => apply({ subject: v || undefined })}
            options={scoped.subjects.map((s) => ({ value: s, label: s }))}
            emptyLabel={scoped.subjects.length ? "כל המקצועות לפי הסינון" : "אין מקצועות לפי הסינון"}
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
            options={scoped.students.map((s) => ({ value: s.id, label: s.full_name }))}
            emptyLabel={scoped.students.length ? "כל התלמידות לפי הסינון" : "אין תלמידות לפי הסינון"}
          />
          <div className="md:col-span-2">
            <Combobox
              label="שיעור"
              value={defaults.lessonId ?? ""}
              onChange={(v) => apply({ lessonId: v || undefined })}
              options={scoped.lessons.map((l) => ({ value: l.id, label: l.label }))}
              emptyLabel={scoped.lessons.length ? "כל השיעורים לפי הסינון" : "אין שיעורים לפי הסינון"}
              maxSuggestions={Math.max(80, scoped.lessons.length)}
            />
            <p className="mt-1 font-caption text-caption text-on-surface-variant">
              בחירת שיעור פותחת את המופעים שלו.
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
